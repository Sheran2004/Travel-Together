import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Trip from './models/Trip.js';
import { TripMember, Conversation, Message, Review, Connection, Favorite, Expense, Report } from './models/misc.js';
import { slugify } from './utils/helpers.js';
import { ensureCategories } from './services/categories.js';

await connectDB();
if ((await User.countDocuments()) > 0 && !process.argv.includes('--fresh')) {
  console.log('Database already has data, so nothing was changed.\nTo wipe EVERYTHING and reseed demo data run: npm run seed --prefix server -- --fresh');
  await mongoose.disconnect(); process.exit(0);
}
await Promise.all([User, Trip, TripMember, Conversation, Message, Review, Connection, Favorite, Expense, Report].map(m => m.deleteMany({})));

await ensureCategories();
const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`;
const avatar = (n) => `https://i.pravatar.cc/300?img=${n}`;
const day = (n) => new Date(Date.now() + n * 864e5);
const hash = (p) => bcrypt.hashSync(p, 10);

const people = [
  ['Demo Traveler', 'demo', 'demo@traveltogether.com', 'Demo@12345', 'Delhi', 'male', 27, 12, ['Trekking', 'Photography', 'Mountains'], ['Adventure', 'Trekking'], ['Manali', 'Ladakh']],
  ['Site Admin', 'admin', 'admin@traveltogether.com', 'Admin@12345', 'Noida', 'male', 30, 14, ['Nature'], ['Nature'], ['Kerala']],
  ['Aarav Sharma', 'aarav', 'aarav@example.com', 'Travel@123', 'Delhi', 'male', 26, 3, ['Trekking', 'Camping', 'Mountains'], ['Trekking', 'Adventure'], ['Manali', 'Spiti']],
  ['Priya Nair', 'priya', 'priya@example.com', 'Travel@123', 'Kochi', 'female', 28, 5, ['Food', 'Beaches', 'Culture'], ['Food', 'Cultural'], ['Kerala', 'Goa']],
  ['Rahul Verma', 'rahul', 'rahul@example.com', 'Travel@123', 'Lucknow', 'male', 24, 8, ['Road trips', 'Bikes', 'Photography'], ['Road trip', 'Photography'], ['Ladakh', 'Kashmir']],
  ['Sneha Iyer', 'sneha', 'sneha@example.com', 'Travel@123', 'Bengaluru', 'female', 25, 9, ['Beaches', 'Yoga', 'Food'], ['Budget', 'Food'], ['Goa', 'Rishikesh']],
  ['Kabir Singh', 'kabir', 'kabir@example.com', 'Travel@123', 'Chandigarh', 'male', 31, 11, ['Rafting', 'Trekking', 'Camping'], ['Adventure', 'Backpacker'], ['Rishikesh', 'Manali']],
  ['Ananya Gupta', 'ananya', 'ananya@example.com', 'Travel@123', 'Jaipur', 'female', 29, 1, ['Culture', 'Heritage', 'Photography'], ['Cultural', 'Photography'], ['Jaipur', 'Udaipur']],
  ['Vikram Rao', 'vikram', 'vikram@example.com', 'Travel@123', 'Hyderabad', 'male', 33, 13, ['Luxury stays', 'Food', 'Wine'], ['Luxury', 'Food'], ['Goa', 'Udaipur']],
  ['Meera Das', 'meera', 'meera@example.com', 'Travel@123', 'Kolkata', 'female', 27, 16, ['Nature', 'Wildlife', 'Culture'], ['Nature', 'Backpacker'], ['Meghalaya', 'Kerala']],
  ['Ishaan Malhotra', 'ishaan', 'ishaan@example.com', 'Travel@123', 'Mumbai', 'male', 23, 17, ['Beaches', 'Nightlife', 'Road trips'], ['Budget', 'Road trip'], ['Goa']],
  ['Tanvi Joshi', 'tanvi', 'tanvi@example.com', 'Travel@123', 'Pune', 'female', 26, 20, ['Trekking', 'Nature', 'Photography'], ['Trekking', 'Nature'], ['Himachal Pradesh', 'Spiti']],
  ['Arjun Menon', 'arjun', 'arjun@example.com', 'Travel@123', 'Chennai', 'male', 30, 15, ['Backpacking', 'Culture', 'Food'], ['Backpacker', 'Budget'], ['Meghalaya', 'Kerala']],
  ['Diya Kapoor', 'diya', 'diya@example.com', 'Travel@123', 'Delhi', 'female', 24, 23, ['Yoga', 'Rafting', 'Camping'], ['Adventure', 'Nature'], ['Rishikesh']],
  ['Neil Fernandes', 'neil', 'neil@example.com', 'Travel@123', 'Panaji', 'male', 35, 33, ['Beaches', 'Photography', 'Food'], ['Photography', 'Food'], ['Goa', 'Kerala']]
];
const users = [];
for (const [name, username, email, pw, city, gender, age, pic, interests, style, favs] of people) {
  users.push(await User.create({ name, username, email, password: hash(pw), city, country: 'India', gender, age, profileImage: avatar(pic), bio: `${name.split(' ')[0]} from ${city}. Loves ${interests.slice(0, 2).join(' & ').toLowerCase()} and meeting new people on the road.`, travelInterests: interests, travelStyle: style, favoriteDestinations: favs, languages: ['English', 'Hindi'], budgetMin: 3000, budgetMax: username === 'vikram' ? 120000 : 30000, role: username === 'admin' ? 'admin' : 'user', emailVerified: true, emergencyContact: username === 'demo' ? { name: 'Family contact', phone: '+91 90000 00000' } : undefined }));
}
const U = Object.fromEntries(users.map(u => [u.username, u]));

// title, destination, city, state, lat, lng, category, style, budget, offsetStart, len, max, mode, difficulty, creator, image, activities
const T = [
  ['Goa Beach Escape', 'Goa', 'Panaji', 'Goa', 15.4909, 73.8278, 'Beach', 'Budget', 12000, 18, 4, 10, 'open', 'Easy', 'sneha', 'photo-1512343879784-a960bf40e7f2', ['Beach hopping', 'Water sports', 'Night market']],
  ['Manali Mountain Trek', 'Manali', 'Manali', 'Himachal Pradesh', 32.2396, 77.1887, 'Trekking', 'Trekking', 9500, 12, 5, 12, 'open', 'Moderate', 'aarav', 'photo-1626621341517-bbf3d9990a23', ['Solang Valley', 'Trek to Beas Kund', 'Bonfire']],
  ['Jaipur Heritage Tour', 'Jaipur', 'Jaipur', 'Rajasthan', 26.9124, 75.7873, 'Cultural', 'Cultural', 7000, 25, 3, 8, 'open', 'Easy', 'ananya', 'photo-1477587458883-47145ed94245', ['Amer Fort', 'City Palace', 'Bazaar walk']],
  ['Rishikesh Adventure Weekend', 'Rishikesh', 'Rishikesh', 'Uttarakhand', 30.0869, 78.2676, 'Adventure', 'Adventure', 6500, 9, 3, 15, 'open', 'Moderate', 'kabir', 'photo-1600100397608-f010f423b971', ['River rafting', 'Camping', 'Cliff jumping']],
  ['Kashmir Valley Explorer', 'Kashmir', 'Srinagar', 'Jammu & Kashmir', 34.0837, 74.7973, 'Nature', 'Photography', 28000, 40, 7, 10, 'request', 'Easy', 'rahul', 'photo-1595815771614-ade9d652a65d', ['Dal Lake shikara', 'Gulmarg', 'Pahalgam']],
  ['Ladakh Road Trip', 'Leh', 'Leh', 'Ladakh', 34.1526, 77.5771, 'Road Trip', 'Road trip', 35000, 55, 9, 8, 'request', 'Hard', 'rahul', 'photo-1506905925346-21bda4d32df4', ['Khardung La', 'Pangong Tso', 'Nubra Valley']],
  ['Kerala Backwaters', 'Kerala', 'Alappuzha', 'Kerala', 9.4981, 76.3388, 'Nature', 'Food', 18000, 30, 5, 8, 'open', 'Easy', 'priya', 'photo-1602216056096-3b40cc0c9944', ['Houseboat stay', 'Munnar tea gardens', 'Kathakali show']],
  ['Udaipur Weekend', 'Udaipur', 'Udaipur', 'Rajasthan', 24.5854, 73.7125, 'Weekend', 'Luxury', 22000, 14, 3, 6, 'request', 'Easy', 'vikram', 'photo-1615836245337-f5b9b0638ff0', ['Lake Pichola boat', 'City Palace', 'Sunset at Monsoon Palace']],
  ['Spiti Valley Expedition', 'Spiti Valley', 'Kaza', 'Himachal Pradesh', 32.2276, 78.0714, 'Road Trip', 'Adventure', 24000, 48, 8, 10, 'open', 'Hard', 'tanvi', 'photo-1605649487212-47bdab064df7', ['Key Monastery', 'Chandratal Lake', 'Kibber village']],
  ['Meghalaya Explorer', 'Shillong', 'Shillong', 'Meghalaya', 25.5788, 91.8933, 'Backpacking', 'Backpacker', 16000, 35, 6, 9, 'open', 'Moderate', 'meera', 'photo-1626714485822-5e2b2d1b6b0b', ['Living root bridges', 'Dawki river', 'Caves']],
  ['Kasol & Kheerganga Trek', 'Kasol', 'Kasol', 'Himachal Pradesh', 32.0100, 77.3150, 'Trekking', 'Backpacker', 8000, 16, 4, 12, 'open', 'Moderate', 'aarav', 'photo-1464822759023-fed622ff2c3b', ['Kheerganga trek', 'Hot springs', 'Cafe hopping']],
  ['Hampi Sunrise Cycling', 'Hampi', 'Hampi', 'Karnataka', 15.335, 76.46, 'Cultural', 'Photography', 7500, 22, 3, 8, 'open', 'Easy', 'sneha', 'photo-1600100398220-ef1d2f7b8c8e', ['Cycling ruins', 'Boulder sunrise', 'Coracle ride']],
  ['Andaman Island Hopping', 'Andaman', 'Port Blair', 'Andaman & Nicobar', 11.6234, 92.7265, 'Beach', 'Luxury', 45000, 60, 6, 8, 'request', 'Easy', 'vikram', 'photo-1589197331516-4d84b72ebde3', ['Scuba diving', 'Havelock Island', 'Radhanagar Beach']],
  ['Coorg Coffee & Waterfalls', 'Coorg', 'Madikeri', 'Karnataka', 12.4244, 75.7382, 'Nature', 'Nature', 11000, 20, 3, 10, 'open', 'Easy', 'meera', 'photo-1609766418204-94aae0ecfdfc', ['Coffee estate walk', 'Abbey Falls', 'Dubare elephant camp']],
  ['Varanasi Ghats & Ganga Aarti', 'Varanasi', 'Varanasi', 'Uttar Pradesh', 25.3176, 82.9739, 'Cultural', 'Cultural', 6000, 28, 3, 10, 'open', 'Easy', 'rahul', 'photo-1561361513-2d000a50f0dc', ['Ganga aarti', 'Boat ride at dawn', 'Food trail']],
  ['Triund Sunset Trek', 'Dharamshala', 'McLeod Ganj', 'Himachal Pradesh', 32.2426, 76.3213, 'Trekking', 'Trekking', 5500, 7, 2, 14, 'open', 'Easy', 'tanvi', 'photo-1551632811-561732d1e306', ['Triund ridge camp', 'Bhagsu waterfall', 'Tibetan food']],
  ['Bangkok Street Food Week', 'Bangkok', 'Bangkok', 'Bangkok', 13.7563, 100.5018, 'International', 'Food', 60000, 75, 7, 6, 'request', 'Easy', 'neil', 'photo-1508009603885-50cf7c579365', ['Street food tour', 'Floating market', 'Temples']],
  ['Pondicherry Weekender', 'Pondicherry', 'Puducherry', 'Puducherry', 11.9416, 79.8083, 'Weekend', 'Budget', 8500, 11, 3, 8, 'open', 'Easy', 'ishaan', 'photo-1582510003544-4d00b7f74220', ['French Quarter walk', 'Auroville', 'Beach cafes']],
  ['Auli Winter Ski Camp', 'Auli', 'Joshimath', 'Uttarakhand', 30.5290, 79.5710, 'Adventure', 'Adventure', 14000, 90, 4, 12, 'open', 'Moderate', 'kabir', 'photo-1551524559-8af4e6624178', ['Skiing lessons', 'Gondola ride', 'Snow camping']],
  ['Goa Photography Walk (past)', 'Goa', 'Old Goa', 'Goa', 15.5009, 73.9116, 'Cultural', 'Photography', 6000, -30, 3, 8, 'open', 'Easy', 'neil', 'photo-1518509562904-e7ef99cdcc86', ['Heritage churches', 'Fontainhas', 'Golden hour']],
  ['Rishikesh Yoga Retreat (past)', 'Rishikesh', 'Rishikesh', 'Uttarakhand', 30.0869, 78.2676, 'Nature', 'Nature', 9000, -20, 4, 10, 'open', 'Easy', 'diya', 'photo-1545389336-cf090694435e', ['Sunrise yoga', 'Ganga aarti', 'Meditation']]
];
const trips = [];
for (const [title, destination, city, state, latitude, longitude, category, travelStyle, budget, off, len, maxMembers, joinMode, difficulty, creator, image, activities] of T) {
  const start = day(off), end = day(off + len - 1);
  const t = await Trip.create({ title, slug: slugify(title), destination, city, state, country: state === 'Bangkok' ? 'Thailand' : 'India', latitude, longitude, category, travelStyle, budget, startDate: start, endDate: end, maxMembers, joinMode, difficulty, creator: U[creator]._id, coverImage: img(image), activities, memberCount: 0,
    description: `${title}: ${len} days in ${destination} with a small friendly group. We share transport and stays to keep costs down, explore ${activities.slice(0, 2).join(' and ').toLowerCase()}, and leave time to relax. Everyone is welcome — just bring a good attitude.`,
    meetingPoint: `${city} main station/airport, day 1 at 8:00 AM`,
    itinerary: Array.from({ length: len }, (_, i) => ({ day: i + 1, date: day(off + i), time: i === 0 ? '08:00' : '09:00', locationName: i === 0 ? city : i === len - 1 ? city : `${activities[i % activities.length]}, ${destination}`, latitude: latitude + (i ? 0.03 * Math.sin(i) : 0), longitude: longitude + (i ? 0.03 * Math.cos(i) : 0), activity: i === 0 ? 'Arrival & check-in' : i === len - 1 ? 'Local market & departure' : activities[(i - 1) % activities.length], description: i === 0 ? 'Meet at the meeting point, settle in and plan the trip over dinner.' : 'Full day activity with a group lunch.', transport: i === 0 ? 'train' : 'car' })),
    checklist: ['Book stay', 'Book transport', 'ID proof', 'Power bank', 'First aid kit', 'Camera'].map((text, i) => ({ text, done: i < 2, addedBy: U[creator]._id })) });
  const conv = await Conversation.create({ type: 'group', trip: t._id, participants: [U[creator]._id] });
  t.conversation = conv._id; await t.save(); trips.push(t);
  await TripMember.create({ trip: t._id, user: U[creator]._id, role: 'owner' }); t.memberCount = 1;
  await t.save();
}
// memberships (spread across users)
const usernames = people.map(p => p[1]).filter(u => u !== 'admin');
let seedIdx = 0;
for (const t of trips) {
  const want = Math.min(t.maxMembers - 1, 2 + (seedIdx++ % 4));
  const pool = usernames.filter(u => String(U[u]._id) !== String(t.creator));
  for (let i = 0; i < want; i++) {
    const u = pool[(seedIdx * 3 + i * 2) % pool.length];
    if (await TripMember.exists({ trip: t._id, user: U[u]._id })) continue;
    if (t.joinMode === 'request' && i > 0 && t.title.includes('Ladakh')) continue;
    await TripMember.create({ trip: t._id, user: U[u]._id }); t.memberCount += 1;
    await Conversation.updateOne({ _id: t.conversation }, { $addToSet: { participants: U[u]._id } });
  }
  await t.save();
}
// make demo user a member of a few trips + full trip example
const ensure = async (t, u) => { if (!(await TripMember.exists({ trip: t._id, user: u._id })) && t.memberCount < t.maxMembers) { await TripMember.create({ trip: t._id, user: u._id }); t.memberCount++; await t.save(); await Conversation.updateOne({ _id: t.conversation }, { $addToSet: { participants: u._id } }); } };
for (const s of ['goa-beach-escape', 'jaipur-heritage-tour', 'goa-photography-walk-past']) await ensure(trips.find(t => t.slug === s), U.demo);
const full = trips.find(t => t.slug === 'udaipur-weekend'); // fill one trip to show "Trip Full"
full.maxMembers = 4; await full.save();
for (const u of ['priya', 'ananya', 'meera']) await ensure(full, U[u]);

// conversation messages
const sample = ['Hey everyone! So excited for this trip 🎉', 'Anyone sorting the train tickets yet?', 'I will book the stay, please share your ID names.', 'Do we need cash for the local transport?', 'Just checked the weather, looks great!', 'Meeting point works for me 👍'];
for (const t of trips) {
  const members = await TripMember.find({ trip: t._id }); let i = 0;
  for (const m of members.slice(0, 4)) await Message.create({ conversation: t.conversation, sender: m.user, type: 'text', text: sample[i++ % sample.length], readBy: [m.user], createdAt: new Date(Date.now() - (10 - i) * 36e5) });
  const last = await Message.findOne({ conversation: t.conversation }).sort('-createdAt');
  if (last) await Conversation.updateOne({ _id: t.conversation }, { lastMessage: last._id, lastMessageAt: last.createdAt });
}
// private chats
const pair = async (a, b, lines) => {
  const [x, y] = [String(a._id), String(b._id)].sort();
  const c = await Conversation.create({ type: 'private', participants: [a._id, b._id], pairKey: `${x}:${y}` });
  let last; for (let i = 0; i < lines.length; i++) last = await Message.create({ conversation: c._id, sender: i % 2 ? b._id : a._id, text: lines[i], readBy: i % 2 ? [b._id, a._id] : [a._id], createdAt: new Date(Date.now() - (lines.length - i) * 6e5) });
  await Conversation.updateOne({ _id: c._id }, { lastMessage: last._id, lastMessageAt: last.createdAt });
};
await pair(U.aarav, U.demo, ['Hi! Saw you are into trekking too.', 'Yes! Planning Manali in a couple of weeks — want to join?', 'Definitely. What is the budget like?', 'Around ₹9,500 all in. Check the trip page!']);
await pair(U.rahul, U.demo, ['Are you free for the Ladakh road trip?', 'Still deciding. Will confirm this week.']);
// connections
for (const [a, b, s] of [['demo', 'aarav', 'accepted'], ['demo', 'priya', 'accepted'], ['rahul', 'demo', 'pending'], ['kabir', 'demo', 'pending'], ['sneha', 'priya', 'accepted']]) await Connection.create({ requester: U[a]._id, recipient: U[b]._id, status: s });
// favorites
for (const s of ['manali-mountain-trek', 'kerala-backwaters', 'ladakh-road-trip']) { const t = trips.find(x => x.slug === s); await Favorite.create({ user: U.demo._id, trip: t._id }); t.savedCount++; await t.save(); }
// reviews for completed (past) trips
for (const s of ['goa-photography-walk-past', 'rishikesh-yoga-retreat-past']) {
  const t = trips.find(x => x.slug === s); t.status = 'completed';
  const ms = await TripMember.find({ trip: t._id }); let sum = 0, n = 0;
  for (const m of ms.slice(0, 3)) { const rating = 4 + (n % 2); await Review.create({ trip: t._id, author: m.user, rating, comment: ['Wonderful group, well organised!', 'Loved every minute. Would travel with them again.', 'Great vibes and lots of laughs.'][n % 3] }); sum += rating; n++; }
  t.avgRating = Math.round((sum / n) * 10) / 10; t.reviewCount = n; await t.save();
}
// expenses on Goa trip
const goa = trips.find(t => t.slug === 'goa-beach-escape'); const gm = (await TripMember.find({ trip: goa._id })).map(m => m.user);
await Expense.create({ trip: goa._id, description: 'Villa deposit', amount: 6000, paidBy: gm[0], participants: gm });
await Expense.create({ trip: goa._id, description: 'Scooter rentals', amount: 1800, paidBy: gm[1] || gm[0], participants: gm });
await Report.create({ reporter: U.demo._id, targetType: 'user', targetUser: U.ishaan._id, category: 'Spam', details: 'Sample report for the admin queue.' });

console.log(`Seeded ${users.length} users, ${trips.length} trips.\nDemo user:  demo@traveltogether.com / Demo@12345\nAdmin:      admin@traveltogether.com / Admin@12345`);
await mongoose.disconnect();
