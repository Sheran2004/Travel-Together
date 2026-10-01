import { Link } from 'react-router-dom';
import { Search, Users, Map, ShieldCheck, MessageCircle, Wallet, Compass, HeartHandshake, Flag, Ban, Lock, FileText, Route } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { DestinationCard, TripCard } from '../components/cards';
import { Async, CardSkeletons, SectionHead, EmptyState } from '../components/ui';

const HERO = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2000&q=70';
export default function Home() {
  const { user } = useAuth();
  const dest = useFetch('/destinations'); const trips = useFetch('/trips/popular');
  const steps = [[Search, 'Discover', 'Browse trips on the map or by dates, budget and style.'], [MessageCircle, 'Connect', 'Message travelers, compare interests and call before you commit.'], [Route, 'Plan', 'Build the itinerary, split costs and share a checklist.'], [Compass, 'Travel', 'Meet up, travel together and leave reviews afterwards.']];
  const why = [[Users, 'Meet fellow travelers', 'Find people who like the same pace, budget and places.'], [Wallet, 'Split travel costs', 'Shared stays and rides. Expenses are tracked and settled in-app.'], [Map, 'Discover new places', 'A live map of real trips, from weekend getaways to month-long roads.'], [ShieldCheck, 'Safer group travel', 'Block, report, restrict and control who can message you.'], [HeartHandshake, 'Build travel communities', 'Keep in touch with your travel network for the next journey.']];
  return (
    <>
      <section className="relative isolate overflow-hidden text-white">
        <img src={HERO} alt="Mountain road in Ladakh at sunrise" className="absolute inset-0 -z-10 h-full w-full object-cover" fetchpriority="high" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#061a20]/90 via-[#061a20]/55 to-transparent" />
        <div className="container-x py-20 sm:py-28 lg:py-36">
          <p className="mb-4 w-fit rounded-full bg-white/15 px-3.5 py-1 text-sm backdrop-blur">Find people. Share journeys. Create memories.</p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.05] sm:text-6xl lg:text-7xl">Your next adventure starts with the right people.</h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">Find travelers, discover trips, plan adventures and create memories together.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link to="/explore" className="btn-accent !px-6 !py-3">Explore Trips</Link><Link to={user ? '/partners' : '/register'} className="btn !px-6 !py-3 bg-white/95 text-[#0e222b] hover:bg-white">Find Travel Partners</Link><Link to="/trips/new" className="btn !px-6 !py-3 border border-white/50 text-white hover:bg-white/10">Create a Trip</Link></div>
        </div>
      </section>

      <section className="container-x py-16">
        <SectionHead title="Popular destinations" sub="Open trips by destination, updated live." />
        <Async loading={dest.loading} error={dest.error} onRetry={dest.reload} skeleton={<CardSkeletons n={4} />}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{dest.data?.destinations.slice(0, 8).map((d) => <DestinationCard key={d.slug} d={d} />)}</div>
        </Async>
      </section>

      <section className="container-x pb-16">
        <SectionHead title="Featured travel groups" sub="Groups filling up soon." to="/explore" />
        <Async loading={trips.loading} error={trips.error} onRetry={trips.reload} skeleton={<CardSkeletons n={3} />}>
          {trips.data?.trips.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{trips.data.trips.slice(0, 4).map((t) => <TripCard key={t._id} trip={t} />)}</div>
            : <EmptyState icon={Compass} title="No trips yet" text="Be the first to create a group." action={<Link className="btn-primary" to="/trips/new">Create a trip</Link>} />}
        </Async>
      </section>

      <section className="bg-surface py-16"><div className="container-x">
        <h2 className="mb-8 text-2xl font-bold sm:text-3xl">How it works</h2>
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{steps.map(([I, t, d], i) => <li key={t} className="relative"><span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand"><I className="h-6 w-6" /></span><h3 className="text-lg font-bold">{i + 1}. {t}</h3><p className="mt-1 text-sm text-muted">{d}</p></li>)}</ol>
      </div></section>

      <section className="container-x grid items-center gap-10 py-16 lg:grid-cols-2">
        <div><h2 className="text-2xl font-bold sm:text-3xl">Find your travel partner</h2><p className="mt-3 max-w-lg text-muted">We compare destinations, travel style, budget, interests and dates, then show you a compatibility score with the exact reasons. It's a transparent rule-based match, not a black box.</p>
          <div className="mt-6 flex gap-3"><Link to={user ? '/partners' : '/register'} className="btn-primary">Find Travel Partners</Link></div></div>
        <div className="card space-y-3 p-5"><div className="flex items-center justify-between"><p className="font-bold">Example match</p><p className="font-display text-3xl font-extrabold text-brand">82%</p></div><div className="h-2 overflow-hidden rounded-full bg-raised"><div className="h-full w-[82%] bg-brand" /></div><p className="text-sm text-muted">Matches on destination, travel style and budget.</p></div>
      </section>

      <section className="bg-surface py-16"><div className="container-x">
        <h2 className="mb-8 text-2xl font-bold sm:text-3xl">Why Travel Together</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{why.map(([I, t, d]) => <div key={t} className="rounded-xl2 border border-line p-5"><I className="mb-3 h-6 w-6 text-brand" /><h3 className="font-bold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></div>)}</div>
      </div></section>

      <section className="container-x py-16">
        <h2 className="mb-2 text-2xl font-bold sm:text-3xl">Travel with confidence</h2><p className="mb-8 max-w-xl text-muted">Meeting new people should feel safe. These tools are built in, not bolted on.</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[[Flag, 'Report', 'Flag users, trips or messages to moderators.'], [Ban, 'Block', 'Blocked users can no longer contact you.'], [Lock, 'Privacy controls', 'Choose who can message you and who sees you online.'], [FileText, 'Community guidelines', 'Clear rules for respectful travel groups.']].map(([I, t, d]) => <div key={t} className="card p-5"><I className="mb-3 h-6 w-6 text-brand" /><h3 className="font-bold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></div>)}</div>
        <p className="mt-4 text-sm text-muted">Profiles are self-reported. Meet in public places first and read the <Link to="/safety" className="text-brand underline">safety center</Link>.</p>
      </section>

      <section className="container-x pb-8"><div className="rounded-xl2 bg-brand p-8 text-center text-brand-ink sm:p-14"><h2 className="text-3xl font-extrabold sm:text-4xl">Where are you going next?</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link to="/explore" className="btn-accent !px-6 !py-3">Explore Trips</Link><Link to="/trips/new" className="btn !px-6 !py-3 bg-white text-[#0e222b]">Create Trip</Link></div></div></section>
    </>
  );
}
