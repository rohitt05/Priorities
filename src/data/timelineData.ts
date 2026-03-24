// Mock timeline event data - typed as any[] since mock data omits DB-only fields (senderId, receiverId, sentAt)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TIMELINE_EVENTS: any[] = [
    {
        "id": "ev_0025",
        "userUniqueId": "lana143",
        "timestamp": "2025-09-21T19:53:00+05:30",
        "sender": "them",
        "type": "voice_call",
        "durationSec": 1516
    },
    {
        "id": "ev_0023",
        "userUniqueId": "lana143",
        "timestamp": "2025-09-21T11:34:00+05:30",
        "sender": "me",
        "type": "photo",
        "uri": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e",
        "thumbUri": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=300&fit=crop"
    },
    {
        "id": "ev_0016",
        "userUniqueId": "jane_doe",
        "timestamp": "2025-09-21T09:29:00+05:30",
        "sender": "them",
        "type": "photo",
        "uri": "https://images.unsplash.com/photo-1472214103451-9374bd1c798e",
        "thumbUri": "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=300&h=300&fit=crop"
    },
    {
        "id": "ev_0017",
        "userUniqueId": "jane_doe",
        "timestamp": "2025-09-21T08:21:00+05:30",
        "sender": "me",
        "type": "voice_call",
        "durationSec": 1636
    },
    {
        "id": "ev_0015",
        "userUniqueId": "jane_doe",
        "timestamp": "2025-09-21T07:50:00+05:30",
        "sender": "me",
        "type": "audio",
        "durationSec": 104,
        "title": "Voice note",
        "uri": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    },
    {
        "id": "ev_0024",
        "userUniqueId": "lana143",
        "timestamp": "2025-09-21T07:18:00+05:30",
        "sender": "them",
        "type": "note",
        "text": "Can't wait to see you"
    },
    {
        "id": "ev_0019",
        "userUniqueId": "jane_doe",
        "timestamp": "2025-09-21T06:22:00+05:30",
        "sender": "them",
        "type": "video_call",
        "durationSec": 2990
    },
    {
        "id": "ev_0014",
        "userUniqueId": "jane_doe",
        "timestamp": "2025-09-20T13:24:00+05:30",
        "sender": "them",
        "type": "video",
        "durationSec": 24,
        "uri": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "thumbUri": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=300&fit=crop"
    },
    {
        "id": "ev_0021",
        "userUniqueId": "charlie_brown",
        "timestamp": "2025-09-20T09:34:00+05:30",
        "sender": "them",
        "type": "audio",
        "durationSec": 34,
        "title": "Audio message",
        "uri": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
    },
    {
        "id": "ev_0022",
        "userUniqueId": "charlie_brown",
        "timestamp": "2025-09-20T02:30:00+05:30",
        "sender": "me",
        "type": "photo",
        "uri": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29",
        "thumbUri": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=300&fit=crop"
    },
    {
        "id": "ev_0013",
        "userUniqueId": "jane_doe",
        "timestamp": "2025-09-19T19:59:00+05:30",
        "sender": "me",
        "type": "photo",
        "uri": "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d",
        "thumbUri": "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=300&h=300&fit=crop"
    }
];
