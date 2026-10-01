import { Link } from 'react-router-dom';
import { Compass, MessageCircle, Bookmark, Users, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useFetch } from '../hooks/useFetch';
import { TripCard, TravelerCard } from '../components/cards';
import { Async, CardSkeletons, EmptyState, SectionHead, Avatar } from '../components/ui';
import { greeting, timeAgo, dateRange } from '../utils/format';
import { useSavedToggle } from '../hooks/useSaved';

export default function Dashboard() {
  const { user } = useAuth(); const { notifications, unread } = useSocket();
  const rec = useFetch('/trips/recommended'); const mine = useFetch('/trips/mine'); const pop = useFetch('/trips/popular');
  const people = useFetch('/users/search', { limit: 3 }); const saved = useFetch('/users/favorites'); const convs = useFetch('/conversations');
  const { isSaved, toggle } = useSavedToggle(saved.data?.trips);
  const upcoming = mine.data?.upcoming?.filter((t) => new Date(t.endDate) >= new Date()).sort((a, b) => new Date(a.startDate) - new Date(b.startDate)) || [];
  return (
    <div className="container-x space-y-12 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-extrabold sm:text-4xl">{greeting()}, {user.name.split(' ')[0]} 👋</h1><p className="mt-1 text-muted">Here's what's happening across your trips.</p></div>
        <div className="flex gap-2"><Link to="/explore" className="btn-primary"><Compass className="h-4 w-4" />Explore</Link><Link to="/trips/new" className="btn-accent">Create Trip</Link></div></div>

      <section><SectionHead title="Upcoming trips" sub="Trips you've joined or created." to="/my-trips" />
        <Async loading={mine.loading} error={mine.error} onRetry={mine.reload} skeleton={<CardSkeletons n={3} />}>
          {upcoming.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{upcoming.slice(0, 3).map((t) => <TripCard key={t._id} trip={t} />)}</div> : <EmptyState icon={Compass} title="No upcoming trips" text="Join a group or create your own to see it here." action={<Link to="/explore" className="btn-primary">Find a trip</Link>} />}
        </Async></section>

      <section><SectionHead title="Recommended for you" sub="Rule-based: matches your interests, favorite destinations, travel style and budget." to="/explore" />
        <Async loading={rec.loading} error={rec.error} onRetry={rec.reload} skeleton={<CardSkeletons n={3} />}>
          {rec.data?.trips.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{rec.data.trips.slice(0, 4).map((t) => <TripCard key={t._id} trip={t} showMatch onSave={toggle} saved={isSaved(t._id)} />)}</div>
            : <EmptyState icon={Compass} title="No recommendations yet" text="Add travel interests and favorite destinations to your profile to get suggestions." action={<Link to="/profile" className="btn-primary">Update profile</Link>} />}
        </Async></section>

      <section><SectionHead title="Popular trips" sub="Groups with the most members." to="/explore?sort=members" />
        <Async loading={pop.loading} error={pop.error} onRetry={pop.reload} skeleton={<CardSkeletons n={3} />}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{pop.data?.trips.slice(0, 4).map((t) => <TripCard key={t._id} trip={t} onSave={toggle} saved={isSaved(t._id)} />)}</div></Async></section>

      <section><SectionHead title="Travelers you may click with" to="/partners" linkText="Find partners" />
        <Async loading={people.loading} error={people.error} onRetry={people.reload} skeleton={<CardSkeletons n={3} />}>
          {people.data?.users.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{people.data.users.map((t) => <TravelerCard key={t._id} t={t} />)}</div> : <EmptyState icon={Users} title="No travelers found" />}</Async></section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5"><h2 className="mb-3 flex items-center gap-2 font-bold"><Bookmark className="h-4 w-4 text-brand" />Saved trips</h2>
          {saved.loading ? <div className="skeleton h-24" /> : saved.data?.trips.length ? <ul className="space-y-2">{saved.data.trips.slice(0, 4).map((t) => <li key={t._id}><Link to={`/trips/${t.slug}`} className="block rounded-lg px-2 py-1.5 hover:bg-raised"><p className="truncate font-medium">{t.title}</p><p className="text-xs text-muted">{dateRange(t.startDate, t.endDate)}</p></Link></li>)}</ul> : <p className="text-sm text-muted">Your saved trips will appear here.</p>}
          <Link to="/saved" className="mt-3 block text-sm font-semibold text-brand">View all</Link></section>
        <section className="card p-5"><h2 className="mb-3 flex items-center gap-2 font-bold"><MessageCircle className="h-4 w-4 text-brand" />Recent messages</h2>
          {convs.loading ? <div className="skeleton h-24" /> : convs.data?.conversations.length ? <ul className="space-y-1">{convs.data.conversations.slice(0, 4).map((c) => <li key={c._id}><Link to={`/messages/${c._id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-raised">{c.type === 'group' ? <img src={c.group?.coverImage} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <Avatar user={c.other} size={36} />}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{c.group?.title || c.other?.name}</span><span className="block truncate text-xs text-muted">{c.lastMessage?.text || (c.lastMessage ? `[${c.lastMessage.type}]` : 'No messages yet')}</span></span>{c.unread > 0 && <span className="rounded-full bg-brand px-2 text-xs font-bold text-brand-ink">{c.unread}</span>}</Link></li>)}</ul> : <p className="text-sm text-muted">No conversations yet.</p>}
          <Link to="/messages" className="mt-3 block text-sm font-semibold text-brand">Open messages</Link></section>
        <section className="card p-5"><h2 className="mb-3 flex items-center gap-2 font-bold"><Bell className="h-4 w-4 text-brand" />Notifications {unread > 0 && <span className="rounded-full bg-danger px-2 text-xs text-white">{unread}</span>}</h2>
          {notifications.length ? <ul className="space-y-2">{notifications.slice(0, 4).map((n) => <li key={n._id}><Link to={n.link || '/notifications'} className="block rounded-lg px-2 py-1.5 hover:bg-raised"><p className={`text-sm ${n.read ? '' : 'font-semibold'}`}>{n.title}</p><p className="truncate text-xs text-muted">{n.body} · {timeAgo(n.createdAt)}</p></Link></li>)}</ul> : <p className="text-sm text-muted">You're all caught up.</p>}
          <Link to="/notifications" className="mt-3 block text-sm font-semibold text-brand">View all</Link></section>
      </div>
    </div>
  );
}
