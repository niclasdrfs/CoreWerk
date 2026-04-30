import { useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type VoiceState = "idle" | "wakeword" | "listening" | "processing" | "speaking";

interface VoiceResult {
  action: string;
  params: Record<string, any>;
}

const WAKE_WORDS = [
  "hey werkey", "hey worki", "heyeworkey", "hey werki", "hey werkiy",
  "hey workey", "hey work", "heywerkey", "hey werke", "hey wörki",
  "hey wörkey", "he werkey", "hey berkey", "hey verkey",
];

function containsWakeWord(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return WAKE_WORDS.some((w) => normalized.includes(w));
}

export const useVoiceAssistant = () => {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { roles } = useAuth();
  const recognitionRef = useRef<any>(null);
  const wakeWordRef = useRef<any>(null);
  const returnToWakeWord = useRef(false);
  const queryClient = useQueryClient();

  const speak = useCallback((text: string) => {
    setState("speaking");
    setResponse(text);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.onend = () => {
      if (returnToWakeWord.current) {
        startWakeWordListener();
      } else {
        setState("idle");
      }
    };
    utterance.onerror = () => {
      if (returnToWakeWord.current) {
        startWakeWordListener();
      } else {
        setState("idle");
      }
    };
    speechSynthesis.speak(utterance);
  }, []);

  const handleResult = useCallback((result: VoiceResult) => {
    const { action, params } = result;
    switch (action) {
      case "navigate":
        speak(params.spokenResponse);
        navigate(params.path);
        break;
      case "dictate": {
        const el = document.activeElement;
        if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
          const start = el.selectionStart ?? el.value.length;
          const end = el.selectionEnd ?? el.value.length;
          const newValue = el.value.slice(0, start) + params.text + el.value.slice(end);
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            "value"
          )?.set;
          nativeInputValueSetter?.call(el, newValue);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          toast.info("Kein Eingabefeld fokussiert – Text kopiert", { description: params.text });
        }
        speak(params.spokenResponse);
        break;
      }
      case "create_assignment":
        if (params.success) {
          toast.success("Kalendereintrag erstellt", { description: params.spokenResponse });
          // Invalidate calendar queries to refresh
          queryClient.invalidateQueries({ queryKey: ["daily-assignments"] });
          queryClient.invalidateQueries({ queryKey: ["assignments"] });
        }
        speak(params.spokenResponse);
        break;
      case "create_construction_site":
        if (params.success) {
          toast.success("Baustelle erstellt", { description: params.customer_last_name });
          queryClient.invalidateQueries({ queryKey: ["construction-sites"] });
          queryClient.invalidateQueries({ queryKey: ["constructionSites"] });
        }
        speak(params.spokenResponse);
        break;
      case "update_construction_site":
        if (params.success) {
          toast.success("Baustelle aktualisiert");
          queryClient.invalidateQueries({ queryKey: ["construction-sites"] });
          queryClient.invalidateQueries({ queryKey: ["constructionSites"] });
        }
        speak(params.spokenResponse);
        break;
      case "answer":
      default:
        speak(params.spokenResponse);
        break;
    }
  }, [navigate, speak, queryClient]);

  const processTranscript = useCallback(async (text: string) => {
    setState("processing");
    try {
      const { data, error } = await supabase.functions.invoke("voice-assistant", {
        body: {
          transcript: text,
          currentPath: location.pathname,
          userRole: roles[0] || "unknown",
        },
      });
      if (error) throw error;
      handleResult(data as VoiceResult);
    } catch (e) {
      console.error("Voice assistant error:", e);
      speak("Es ist ein Fehler aufgetreten.");
    }
  }, [location.pathname, roles, handleResult, speak]);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Spracherkennung wird in diesem Browser nicht unterstützt.");
      return;
    }

    speechSynthesis.cancel();

    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setState("listening");
      setTranscript("");
      setResponse("");
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript || interimTranscript);
      if (finalTranscript) {
        processTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "aborted") {
        if (returnToWakeWord.current) {
          startWakeWordListener();
        } else {
          setState("idle");
        }
        if (event.error === "not-allowed") {
          toast.error("Mikrofonzugriff verweigert.");
        }
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        recognitionRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [processTranscript]);

  const startWakeWordListener = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (wakeWordRef.current) {
      try { wakeWordRef.current.abort(); } catch {}
      wakeWordRef.current = null;
    }

    setState("wakeword");
    returnToWakeWord.current = true;

    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (containsWakeWord(text)) {
          recognition.stop();
          wakeWordRef.current = null;
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.15;
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
          } catch {}
          startListening();
          return;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Wake word listener error:", event.error);
      if (event.error === "not-allowed") {
        returnToWakeWord.current = false;
        setState("idle");
        toast.error("Mikrofonzugriff verweigert.");
        return;
      }
      if (returnToWakeWord.current && event.error !== "aborted") {
        setTimeout(() => {
          if (returnToWakeWord.current) startWakeWordListener();
        }, 1000);
      }
    };

    recognition.onend = () => {
      if (returnToWakeWord.current && wakeWordRef.current === recognition) {
        setTimeout(() => {
          if (returnToWakeWord.current) startWakeWordListener();
        }, 300);
      }
    };

    wakeWordRef.current = recognition;
    recognition.start();
  }, [startListening]);

  const stopAll = useCallback(() => {
    returnToWakeWord.current = false;
    if (wakeWordRef.current) {
      try { wakeWordRef.current.abort(); } catch {}
      wakeWordRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    speechSynthesis.cancel();
    setState("idle");
  }, []);

  const toggle = useCallback(() => {
    if (state === "idle") {
      startWakeWordListener();
    } else if (state === "wakeword") {
      stopAll();
    } else {
      stopAll();
    }
  }, [state, startWakeWordListener, stopAll]);

  return { state, transcript, response, toggle, startListening, stopListening: stopAll };
};
