import { Meetings } from "@/common/model";
import { dbManager } from "@/database/dbManager";
import { useRecorderContext } from "@/recorder/RecordingProvider";
import { useEffect, useState } from "react";

export default function useMeetings() {
    const [meetings, setMeetings] = useState<Meetings | null>(null);
    const { recorderState } = useRecorderContext();

    useEffect(() => {
        const fetchMeetings = async () => {
            const meetings = await dbManager.getMeetings();
            setMeetings(meetings);
        };

        void fetchMeetings();
    }, [recorderState]);

    return meetings;
}
