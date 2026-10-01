import { Link } from 'react-router-dom';
import { CalendarDays, Users, Wallet, MapPin, Bookmark, Star, MessageCircle, UserPlus, Clock, Check } from 'lucide-react';
import { Avatar, SafeImg } from './ui';
import { assetUrl } from '../services/api';
import { inr, dateRange, duration, daysUntil } from '../utils/format';

export function TripCard({ trip, onSave, saved, showMatch }) {
  const full = trip.memberCount >= trip.maxMembers; const left = trip.maxMembers - trip.memberCount; const until = daysUntil(trip.startDate);
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
      <Link to={`/trips/${trip.slug || trip._id}`} className="relative block h-44 overflow-hidden bg-raised" aria-label={trip.title}>
        <SafeImg src={trip.coverImage} alt={`${trip.destination} cover`} label={trip.destination} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">{trip.category}</span>
        {trip.status === 'cancelled' ? <span className="absolute right-3 top-3 rounded-full bg-danger px-2.5 py-1 text-xs font-semibold text-white">Cancelled</span>
          : full ? <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">Full</span>
          : until > 0 && until <= 14 ? <span className="absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-[#1c1300]">Starts in {until}d</span> : null}
        {trip.distanceKm != null && <span className="absolute bottom-3 left-3 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-brand-ink">{trip.distanceKm} km away</span>}
      </Link>
      {onSave && <button onClick={() => onSave(trip)} aria-label={saved ? 'Remove from saved' : 'Save trip'} aria-pressed={!!saved} className="absolute right-3 top-[8.4rem] grid h-9 w-9 place-items-center rounded-full bg-surface shadow-card hover:scale-105"><Bookmark className={`h-4 w-4 ${saved ? 'fill-brand text-brand' : ''}`} /></button>}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div><Link to={`/trips/${trip.slug || trip._id}`} className="line-clamp-1 font-display text-lg font-bold hover:text-brand">{trip.title}</Link>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><MapPin className="h-3.5 w-3.5" />{[trip.city && trip.city !== trip.destination ? trip.city : null, trip.destination, trip.state].filter(Boolean).slice(0, 2).join(', ')}</p></div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-brand" /><dt className="sr-only">Dates</dt><dd className="truncate">{dateRange(trip.startDate, trip.endDate).split(' – ')[0]} · {duration(trip.startDate, trip.endDate)}d</dd></div>
          <div className="flex items-center gap-1.5"><Wallet className="h-4 w-4 text-brand" /><dt className="sr-only">Budget</dt><dd>{inr(trip.budget)}</dd></div>
          <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-brand" /><dt className="sr-only">Members</dt><dd>{trip.memberCount}/{trip.maxMembers} {!full && left <= 3 && <span className="text-accent">· {left} left</span>}</dd></div>
          {trip.avgRating > 0 ? <div className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-accent text-accent" /><dd>{trip.avgRating} ({trip.reviewCount})</dd></div> : trip.travelStyle && <div className="chip w-fit">{trip.travelStyle}</div>}
        </dl>
        {showMatch && trip.matchReasons?.length > 0 && <p className="rounded-lg bg-raised px-3 py-2 text-xs text-muted">Suggested for {trip.matchReasons.slice(0, 2).join(' and ')}</p>}
        <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
          {trip.creator && <Link to={`/travelers/${trip.creator.username}`} className="flex items-center gap-2 text-sm hover:text-brand"><Avatar user={trip.creator} size={26} /><span className="max-w-[8rem] truncate">{trip.creator.name}</span></Link>}
          <Link to={`/trips/${trip.slug || trip._id}`} className="btn-primary btn-sm">{full ? 'View' : trip.joinMode === 'request' ? 'Request' : 'Join'}</Link>
        </div>
      </div>
    </article>
  );
}

export function DestinationCard({ d }) {
  return (
    <Link to={`/destinations/${d.slug}`} className="group relative block h-72 overflow-hidden rounded-xl2 shadow-card">
      <SafeImg src={d.image} alt={`${d.name} landscape`} label={d.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <p className="text-xs font-medium text-white/80">{d.activeTrips} {d.activeTrips === 1 ? 'trip' : 'trips'} open</p>
        <h3 className="font-display text-2xl font-bold">{d.name}</h3><p className="mt-1 line-clamp-2 text-sm text-white/85">{d.blurb}</p>
        <span className="mt-3 inline-flex rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-[#0e222b]">Explore {d.name}</span>
      </div>
    </Link>
  );
}

export function TravelerCard({ t, onConnect, busy }) {
  const c = t.connection;
  return (
    <article className="card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <Link to={`/travelers/${t.username}`}><Avatar user={t} size={56} online={t.online} /></Link>
        <div className="min-w-0 flex-1">
          <Link to={`/travelers/${t.username}`} className="block truncate font-display text-lg font-bold hover:text-brand">{t.name}</Link>
          <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="h-3.5 w-3.5" />{t.city || 'Somewhere on Earth'}{t.age ? ` · ${t.age}` : ''}</p>
        </div>
        {t.compatibility && <div className="text-right"><p className="font-display text-xl font-extrabold text-brand">{t.compatibility.score}%</p><p className="text-[11px] text-muted">compatible</p></div>}
      </div>
      {t.compatibility?.explanation && <p className="rounded-lg bg-raised px-3 py-2 text-xs text-muted">{t.compatibility.explanation}</p>}
      <div className="flex flex-wrap gap-1.5">{[...(t.travelStyle || []).slice(0, 2), ...(t.travelInterests || []).slice(0, 3)].map((x) => <span key={x} className="chip">{x}</span>)}</div>
      {t.upcomingTrips?.length > 0 && <p className="text-xs text-muted">Upcoming: {t.upcomingTrips.map((x) => x.destination).join(', ')}</p>}
      <div className="mt-auto flex gap-2">
        <Link to={`/messages?user=${t._id}`} className="btn-primary btn-sm flex-1"><MessageCircle className="h-4 w-4" />Message</Link>
        {!c ? <button className="btn-ghost btn-sm" disabled={busy} onClick={() => onConnect?.(t)}><UserPlus className="h-4 w-4" />Connect</button>
          : c.status === 'accepted' ? <span className="btn-ghost btn-sm pointer-events-none"><Check className="h-4 w-4" />Connected</span>
          : <span className="btn-ghost btn-sm pointer-events-none"><Clock className="h-4 w-4" />{c.direction === 'sent' ? 'Pending' : 'Respond'}</span>}
      </div>
    </article>
  );
}

export function ReviewCard({ r }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line p-4">
      <Avatar user={r.author} size={40} />
      <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><Link to={`/travelers/${r.author?.username}`} className="font-semibold hover:text-brand">{r.author?.name}</Link><span className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span></div>
        <div className="my-1 flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-4 w-4 ${i <= r.rating ? 'fill-accent text-accent' : 'text-line'}`} />)}</div>
        {r.comment && <p className="text-sm text-muted">{r.comment}</p>}</div>
    </div>
  );
}
