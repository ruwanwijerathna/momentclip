import { useEffect, useState } from "react";
import { api, type Job } from "@/lib/api";

/** Subscribes to live job progress over Server-Sent Events. */
export function useJob(initial: Job | null) {
  const [job, setJob] = useState<Job | null>(initial);
  const [lost, setLost] = useState(false);

  useEffect(() => setJob(initial), [initial]);

  useEffect(() => {
    if (!initial) return;
    const es = new EventSource(api.eventsUrl(initial.id));
    es.onmessage = (e) => {
      const next = JSON.parse(e.data) as Job;
      setJob(next);
      setLost(false);
      if (next.status !== "running") es.close();
    };
    es.onerror = () => setLost(true);
    return () => es.close();
  }, [initial]);

  return { job, lost };
}
