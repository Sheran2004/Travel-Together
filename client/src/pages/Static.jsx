import { Link } from 'react-router-dom';
const P = {
  about: ['About Travel Together', ['Travel Together helps people find trips and travel partners, plan together and travel safely.', 'Our tagline says it: Find people. Share journeys. Create memories.']],
  help: ['Help', ['Joining a trip: open a trip and press Join, or Request to Join if the organizer approves members.', 'Messaging: open a traveler profile and press Message. Calls need microphone permission.', 'Reporting: use the Report option on profiles, trips or messages. Visit the Safety center for emergency numbers.']],
  contact: ['Contact', ['Questions or safety concerns? Email support@traveltogether.example (replace with your support address before launch).']],
  privacy: ['Privacy', ['We store the profile details you provide, your trips, messages and notifications in our database.', 'Your exact location is never stored or shown. The "near me" feature uses an approximate position in your browser only.', 'You control who can message you and who sees your online status in Settings. Replace this template with your reviewed policy before launch.']],
  terms: ['Terms of use', ['By using Travel Together you agree to follow the community guidelines and to travel at your own risk.', 'Organizers are responsible for the accuracy of their trips. Replace this template with legally reviewed terms before launch.']]
};
export default function Static({ page }) { const [t, body] = P[page]; return <div className="container-x max-w-2xl space-y-4 py-12"><h1 className="text-3xl font-extrabold">{t}</h1>{body.map((p) => <p key={p} className="text-muted">{p}</p>)}<Link to="/" className="btn-primary mt-4">Back home</Link></div>; }
