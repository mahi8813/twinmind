import { dbManager } from "@/common/dbManager";
import { Meetings } from "@/common/model";
import { useRecorderContext } from "@/common/RecordingProvider";
import { useCallback, useEffect, useState } from "react";

export default function useMeetings() {
    const [meetings, setMeetings] = useState<Meetings | null>(null);
    const { isRecording } = useRecorderContext();

    const fetchMeetings = useCallback(async () => {
        const meetings = await dbManager.getMeetings();
        setMeetings(meetings);
    }, []);

    useEffect(() => {
        void fetchMeetings();
    }, [isRecording, fetchMeetings]);

    return meetings;
}
