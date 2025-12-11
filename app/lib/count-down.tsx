import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface CountdownProps {
  initialMs: number; // e.g. 60000
}

export default function Countdown({ initialMs }: CountdownProps) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(initialMs);

  useEffect(() => {
    // Reset timeLeft when initialMs changes
    setTimeLeft(initialMs);
  }, [initialMs]);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1000 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Format mm:ss
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <span>
      {t('forgotPassword.resendCodeIn')} {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}
