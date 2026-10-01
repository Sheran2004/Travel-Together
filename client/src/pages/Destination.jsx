import { useParams, Link } from 'react-router-dom';
import { MapPin, Compass } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { Async, EmptyState } from '../components/ui';
import { TripCard } from '../components/cards';
import { TripMap, MapView } from '../components/maps';
import { Marker } from 'react-leaflet';
import { Weather } from '../components/trip';

export default function Destination() {
  const { slug } = useParams(); const { data, loading, error, reload } = useFetch(`/destinations/${slug}`);
  const d = data?.destination;
  return (
    <Async loading={loading} error={error} onRetry={reload}>
      {d && <div>
        <section className="relative h-72 sm:h-96"><img src={d.image} alt={d.name} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" /><div className="container-x absolute inset-x-0 bottom-0 pb-8 text-white"><p className="flex items-center gap-1 text-sm"><MapPin className="h-4 w-4" />{d.state}</p><h1 className="text-4xl font-extrabold sm:text-6xl">{d.name}</h1><p className="mt-1">{d.activeTrips} upcoming {d.activeTrips === 1 ? 'group' : 'groups'}</p></div></section>
        <div className="container-x grid gap-10 py-10 lg:grid-cols-3">
          <div className="space-y-10 lg:col-span-2">
            <section><h2 className="mb-2 text-xl font-bold">About {d.name}</h2><p className="text-muted">{d.description}</p><div className="mt-4 flex flex-wrap gap-2">{d.activities.map((a) => <span key={a} className="chip">{a}</span>)}</div></section>
            <section><h2 className="mb-3 text-xl font-bold">Map</h2><TripMap trips={data.trips} className="h-80" fit={data.trips.length > 0} flyTo={data.trips.length ? undefined : [d.latitude, d.longitude]} />{!data.trips.length && <p className="mt-2 text-sm text-muted">No trips are pinned here yet.</p>}</section>
            <section><h2 className="mb-3 text-xl font-bold">Upcoming groups</h2>{data.trips.length ? <div className="grid gap-5 sm:grid-cols-2">{data.trips.map((t) => <TripCard key={t._id} trip={t} />)}</div> : <EmptyState icon={Compass} title={`No open trips to ${d.name}`} text="Start one and let others join you." action={<Link to="/trips/new" className="btn-primary">Create a trip</Link>} />}</section>
          </div>
          <aside className="space-y-6"><div className="card p-5"><h2 className="mb-3 font-bold">Weather in {d.name}</h2><Weather lat={d.latitude} lng={d.longitude} /></div></aside>
        </div></div>}
    </Async>
  );
}
