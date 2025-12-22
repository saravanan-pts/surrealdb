import { useState, useCallback } from "react";

export function useFileProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setProgress(10);
    setError(null);

    try {
      // 1. Read File Content as Text (Client-side)
      const textContent = await file.text();
      setProgress(30);

      // 2. (Optional Step) Call /api/analyze here if you want HITL
      // For now, we will try to find a saved mapping in memory automatically
      const analysisResponse = await fetch("/api/analyze", {
        method: "POST",
        body: new FormData().append("file", file) as any || (() => {
            // Fallback: Create FormData manually if needed, 
            // but for analyze we can also send JSON if we updated that route.
            // Let's stick to the Process route fix first.
            const fd = new FormData();
            fd.append("file", file);
            return fd;
        })(),
      });
      
      // Note: If you haven't updated /api/analyze to return JSON yet, 
      // this part might need adjustment. 
      // For this fix, let's assume we proceed to process directly.

      // 3. Send to API as JSON
      const response = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          textContent: textContent,
          // If you have the HITL modal, pass 'approvedMapping' here.
          // Passing null/undefined relies on the backend's memory or strict default.
          approvedMapping: null, 
          saveToMemory: false
        }),
      });

      setProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Processing failed");
      }

      const result = await response.json();
      setProgress(100);
      return result;

    } catch (err: any) {
      console.error("Processing error:", err);
      setError(err.message || "Failed to process file");
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { processFile, isProcessing, progress, error };
}