import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from './SocketContext';
import { useToast } from './ToastContext';
const Ctx = createContext(null);
export const useCall = () => useContext(Ctx);

/**
 * Real WebRTC 1-to-1 calls. Socket.IO is used only for signaling (offer/answer/ICE);
 * media flows peer-to-peer. States: idle | calling | incoming | connecting | active | ended
 */
export function CallProvider({ children }) {
  const { socket } = useSocket();
  const toast = useToast();
  const [call, setCall] = useState({ state: 'idle' });
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [connection, setConnection] = useState('new');
  const pc = useRef(null); const local = useRef(null); const remote = useRef(new MediaStream());
  const callId = useRef(null); const pendingIce = useRef([]); const incomingOffer = useRef(null);
  const iceServers = useRef(null); const timer = useRef(null); const facing = useRef('user');
  const [, force] = useState(0);
  const streams = { local: local.current, remote: remote.current };

  const cleanup = useCallback(() => {
    clearInterval(timer.current); pc.current?.close(); pc.current = null;
    local.current?.getTracks().forEach((t) => t.stop()); local.current = null; remote.current = new MediaStream();
    callId.current = null; pendingIce.current = []; incomingOffer.current = null; setMuted(false); setCameraOff(false); setConnection('new'); setSeconds(0); force((n) => n + 1);
  }, []);

  const finish = useCallback((info) => {
    cleanup(); setCall({ state: 'ended', ...info }); setTimeout(() => setCall((c) => (c.state === 'ended' ? { state: 'idle' } : c)), 3500);
  }, [cleanup]);

  // fetched per call: TURN credentials (when configured) are short-lived and only issued to logged-in users
  const getServers = async () => { try { return (await api.get('/calls/ice')).data.iceServers; } catch { return [{ urls: 'stun:stun.l.google.com:19302' }]; } };

  const getMedia = async (video) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Your browser does not support calling. Try Chrome, Edge, Firefox or Safari over HTTPS.');
    try { return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { facingMode: facing.current } : false }); }
    catch (e) { throw new Error(e.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser to make calls.' : e.name === 'NotFoundError' ? 'No microphone or camera was found.' : 'Could not access your microphone or camera.'); }
  };

  const buildPeer = async (id) => {
    const p = new RTCPeerConnection({ iceServers: await getServers() });
    p.onicecandidate = (e) => { if (e.candidate && callId.current) socket.emit('call:ice-candidate', { callId: callId.current, candidate: e.candidate }); else if (e.candidate) pendingIce.current.push({ out: e.candidate }); };
    p.ontrack = (e) => { e.streams[0]?.getTracks().forEach((t) => remote.current.addTrack(t)); force((n) => n + 1); };
    p.onconnectionstatechange = () => {
      setConnection(p.connectionState);
      if (p.connectionState === 'connected') { setCall((c) => ({ ...c, state: 'active' })); clearInterval(timer.current); const t0 = Date.now(); timer.current = setInterval(() => setSeconds(Math.floor((Date.now() - t0) / 1000)), 1000); }
      if (p.connectionState === 'failed') { socket.emit('call:end', { callId: callId.current, failed: true }); finish({ error: 'Connection failed. The network may be blocking peer-to-peer audio (a TURN server may be needed).' }); }
    };
    local.current.getTracks().forEach((t) => p.addTrack(t, local.current));
    pc.current = p; return p;
  };

  const start = useCallback(async (peer, type = 'voice') => {
    if (!socket) return toast.error('Not connected to the server yet. Try again in a moment.');
    if (call.state !== 'idle' && call.state !== 'ended') return toast.info('You are already in a call.');
    setCall({ state: 'calling', peer, type });
    try {
      local.current = await getMedia(type === 'video'); force((n) => n + 1);
      const p = await buildPeer();
      const offer = await p.createOffer(); await p.setLocalDescription(offer);
      socket.emit('call:offer', { to: peer._id, offer, callType: type }, (res) => {
        if (!res?.ok) return finish({ peer, error: res?.error || 'Could not place the call' });
        callId.current = res.callId;
        pendingIce.current.filter((x) => x.out).forEach((x) => socket.emit('call:ice-candidate', { callId: res.callId, candidate: x.out })); pendingIce.current = [];
      });
    } catch (e) { finish({ peer, error: e.message }); }
  }, [socket, call.state]); // eslint-disable-line

  const accept = async () => {
    const { peer, type } = call; setCall((c) => ({ ...c, state: 'connecting' }));
    try {
      local.current = await getMedia(type === 'video'); force((n) => n + 1);
      const p = await buildPeer();
      await p.setRemoteDescription(incomingOffer.current);
      for (const c of pendingIce.current.filter((x) => x.in)) await p.addIceCandidate(c.in).catch(() => {}); pendingIce.current = [];
      const answer = await p.createAnswer(); await p.setLocalDescription(answer);
      socket.emit('call:answer', { callId: callId.current, answer }, (res) => { if (!res?.ok) finish({ peer, error: res?.error || 'Call is no longer available' }); });
    } catch (e) { socket.emit('call:reject', { callId: callId.current }); finish({ peer, error: e.message }); }
  };
  const decline = () => { socket.emit('call:reject', { callId: callId.current }); cleanup(); setCall({ state: 'idle' }); };
  const end = () => { if (callId.current) socket.emit('call:end', { callId: callId.current }); const peer = call.peer; cleanup(); setCall({ state: 'ended', peer, duration: seconds }); setTimeout(() => setCall({ state: 'idle' }), 2500); };

  const toggleMute = () => { const t = local.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setMuted(!t.enabled); } };
  const toggleCamera = () => { const t = local.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCameraOff(!t.enabled); } };
  const switchCamera = async () => {
    try {
      facing.current = facing.current === 'user' ? 'environment' : 'user';
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing.current } }); const nt = s.getVideoTracks()[0];
      const sender = pc.current?.getSenders().find((x) => x.track?.kind === 'video'); await sender?.replaceTrack(nt);
      local.current.getVideoTracks().forEach((t) => { t.stop(); local.current.removeTrack(t); }); local.current.addTrack(nt); force((n) => n + 1);
    } catch { toast.error('Could not switch camera'); }
  };

  useEffect(() => {
    if (!socket) return;
    const onIncoming = async ({ callId: id, from, offer, callType }) => {
      if (callId.current || pc.current) { socket.emit('call:reject', { callId: id }); return; }
      callId.current = id; incomingOffer.current = offer; pendingIce.current = []; iceServers.current = iceServers.current || null;
      setCall({ state: 'incoming', peer: from, type: callType });
    };
    const onAnswered = async ({ answer }) => { try { await pc.current?.setRemoteDescription(answer); setCall((c) => ({ ...c, state: 'connecting' })); for (const c of pendingIce.current.filter((x) => x.in)) await pc.current.addIceCandidate(c.in).catch(() => {}); pendingIce.current = pendingIce.current.filter((x) => !x.in); } catch { finish({ error: 'Could not establish the call' }); } };
    const onIce = async ({ candidate }) => { if (pc.current?.remoteDescription) await pc.current.addIceCandidate(candidate).catch(() => {}); else pendingIce.current.push({ in: candidate }); };
    const onEnded = ({ status, duration, reason }) => {
      const peer = call.peer;
      if (status === 'rejected') finish({ peer, error: 'Call declined' });
      else if (status === 'missed') finish({ peer, error: reason || 'No answer' });
      else if (status === 'failed') finish({ peer, error: 'The call was interrupted' });
      else finish({ peer, duration });
    };
    socket.on('call:incoming', onIncoming); socket.on('call:answered', onAnswered); socket.on('call:ice-candidate', onIce); socket.on('call:ended', onEnded);
    return () => { socket.off('call:incoming', onIncoming); socket.off('call:answered', onAnswered); socket.off('call:ice-candidate', onIce); socket.off('call:ended', onEnded); };
  }, [socket, call.peer, finish]);

  return <Ctx.Provider value={{ call, seconds, muted, cameraOff, connection, streams, start, accept, decline, end, toggleMute, toggleCamera, switchCamera }}>{children}</Ctx.Provider>;
}
