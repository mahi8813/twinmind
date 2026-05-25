import { Meetings } from "@/common/model";
import { dbManager } from "@/database/dbManager";
import { useRecorderContext } from "@/recorder/RecordingProvider";
import { useCallback, useEffect, useState } from "react";

export default function useMeetings() {
    const [meetings, setMeetings] = useState<Meetings | null>(null);
    const { recorderState } = useRecorderContext();

    const fetchMeetings = useCallback(async () => {
        const meetings = await dbManager.getMeetings();
        setMeetings(meetings);
    }, []);

    useEffect(() => {
        void fetchMeetings();
    }, [recorderState, fetchMeetings]);

    return meetings;
}
