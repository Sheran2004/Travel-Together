import { Bookmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { useSavedToggle } from '../hooks/useSaved';
import { Async, CardSkeletons, EmptyState } from '../components/ui';
import { TripCard } from '../components/cards';
export default function Saved() {
  const { data, loading, error, reload } = useFetch('/users/favorites'); const s = useSavedToggle(data?.trips);
  const trips = (data?.trips || []).filter((t) => s.isSaved(t._id));
  return (
    <div className="container-x py-8"><h1 className="mb-6 text-3xl font-extrabold">Saved trips</h1>
      <Async loading={loading} error={error} onRetry={reload} skeleton={<CardSkeletons n={3} />}>
        {trips.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{trips.map((t) => <TripCard key={t._id} trip={t} saved onSave={s.toggle} />)}</div>
          : <EmptyState icon={Bookmark} title="Nothing saved yet" text="Your saved trips will appear here. Tap the bookmark on any trip." action={<Link to="/explore" className="btn-primary">Explore trips</Link>} />}</Async></div>
  );
}
