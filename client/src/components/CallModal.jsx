import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, Maximize2, SwitchCamera } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { Avatar } from './ui';
import { mmss } from '../utils/format';

export default function CallModal() {
  const { call, seconds, muted, cameraOff, connection, streams, accept, decline, end, toggleMute, toggleCamera, switchCamera } = useCall();
  const remoteAudio = useRef(null); const remoteVideo = useRef(null); const localVideo = useRef(null); const wrap = useRef(null);
  const active = ['calling', 'incoming', 'connecting', 'active'].includes(call.state); const video = call.type === 'video';
  useEffect(() => { if (remoteAudio.current) remoteAudio.current.srcObject = streams.remote; if (remoteVideo.current) remoteVideo.current.srcObject = streams.remote; if (localVideo.current) localVideo.current.srcObject = streams.local; });
  useEffect(() => { if (call.state === 'incoming') { try { navigator.vibrate?.([300, 200, 300]); } catch { /* optional */ } } }, [call.state]);
  if (call.state === 'idle') return null;
  const peer = call.peer;
  if (call.state === 'ended') return (
    <div className="fixed bottom-24 left-1/2 z-[4000] -translate-x-1/2 rounded-2xl bg-ink px-5 py-3 text-sm text-bg shadow-pop md:bottom-8" role="status">
      {call.error ? call.error : `Call ended${call.duration ? ` · ${mmss(call.duration)}` : ''}`}
    </div>);
  const label = call.state === 'calling' ? `Calling ${peer?.name}…` : call.state === 'incoming' ? `${peer?.name} is calling you` : call.state === 'connecting' ? 'Connecting…' : mmss(seconds);
  const btn = 'grid h-14 w-14 place-items-center rounded-full transition active:scale-95';
  return (
    <div ref={wrap} className="fixed inset-0 z-[4000] grid place-items-center bg-[#07141a]/95 p-4 text-white" role="dialog" aria-modal="true" aria-label="Call">
      <audio ref={remoteAudio} autoPlay playsInline />
      {video && call.state === 'active' && <video ref={remoteVideo} autoPlay playsInline className="absolute inset-0 h-full w-full bg-black object-cover" aria-label="Remote video" />}
      {video && <video ref={localVideo} autoPlay playsInline muted className={`absolute right-4 top-4 z-10 h-36 w-24 rounded-xl border-2 border-white/40 bg-black object-cover sm:h-44 sm:w-32 ${cameraOff ? 'opacity-30' : ''}`} aria-label="Your camera" />}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 text-center">
        {!(video && call.state === 'active') && <><Avatar user={peer} size={112} /><div><h2 className="text-2xl font-bold">{peer?.name}</h2><p className="mt-1 text-white/80" aria-live="polite">{label}</p>
          <p className="mt-1 text-xs text-white/60">{call.type === 'video' ? 'Video call' : 'Voice call'}{connection !== 'new' && call.state !== 'incoming' ? ` · ${connection}` : ''}</p></div></>}
        {video && call.state === 'active' && <p className="rounded-full bg-black/50 px-4 py-1 text-sm" aria-live="polite">{peer?.name} · {label} · {connection}</p>}
        {call.state === 'incoming' ? (
          <div className="flex gap-10"><button onClick={decline} className={`${btn} bg-red-600`} aria-label="Decline call"><PhoneOff className="h-6 w-6" /></button><button onClick={accept} className={`${btn} animate-pulse bg-green-600`} aria-label="Accept call"><Phone className="h-6 w-6" /></button></div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button onClick={toggleMute} className={`${btn} ${muted ? 'bg-white text-black' : 'bg-white/15'}`} aria-pressed={muted} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>{muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}</button>
            {video && <button onClick={toggleCamera} className={`${btn} ${cameraOff ? 'bg-white text-black' : 'bg-white/15'}`} aria-pressed={cameraOff} aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}>{cameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}</button>}
            {video && <button onClick={switchCamera} className={`${btn} bg-white/15`} aria-label="Switch camera"><SwitchCamera className="h-6 w-6" /></button>}
            {video && <button onClick={() => wrap.current?.requestFullscreen?.()} className={`${btn} bg-white/15`} aria-label="Full screen"><Maximize2 className="h-6 w-6" /></button>}
            <button onClick={end} className={`${btn} bg-red-600`} aria-label="End call"><PhoneOff className="h-6 w-6" /></button>
          </div>)}
        {call.state === 'active' && !video && <p className="flex items-center gap-1 text-xs text-white/60"><Volume2 className="h-3.5 w-3.5" />Audio plays through your device's current output</p>}
      </div>
    </div>
  );
}
