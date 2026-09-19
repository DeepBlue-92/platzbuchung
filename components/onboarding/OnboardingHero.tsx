import React, { useEffect, useState } from "react";
import { Lottie } from "lottie-react";
import { Sparkles } from "lucide-react";

interface OnboardingHeroProps {
  welcomeTitle: string;
  welcomeDescription: string;
  primaryColor?: string;
  showAnimation?: boolean;
}

export const OnboardingHero: React.FC<OnboardingHeroProps> = ({
  welcomeTitle,
  welcomeDescription,
  primaryColor = "#1b4332",
  showAnimation = true,
}) => {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [lottieFailed, setLottieFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetch("/images/onboarding_animation.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch animation: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setAnimationData(data);
        }
      })
      .catch((err) => {
        console.warn("Could not load /images/onboarding_animation.json:", err);
        if (isMounted) {
          setLottieFailed(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const LottieComponent = Lottie as any;

  return (
    <div
      id="onboarding-hero-column"
      className="flex flex-col justify-center text-center md:text-left space-y-3.5 md:space-y-4"
    >
      {/* Lottie Animation (Hidden on mobile < md to conserve vertical space) */}
      {showAnimation && (
        <div
          id="onboarding-hero-animation-container"
          className="hidden md:flex items-center justify-center md:justify-start w-full max-h-[190px] h-[175px] mb-1"
        >
          {!lottieFailed && animationData ? (
            <div className="w-full max-w-[220px] h-full flex items-center justify-center">
              <LottieComponent
                src={animationData}
                loop={true}
                autoplay={true}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          ) : !lottieFailed ? (
            <div className="w-full max-w-[220px] h-full flex items-center justify-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner animate-pulse"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Sparkles className="w-8 h-8" style={{ color: primaryColor }} />
              </div>
            </div>
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <Sparkles className="w-8 h-8" style={{ color: primaryColor }} />
            </div>
          )}
        </div>
      )}

      {/* Welcome Title in Playfair Display / Serif */}
      <h2
        id="onboarding-welcome-title"
        className="font-serif text-2xl lg:text-3xl font-semibold text-slate-900 tracking-tight"
      >
        {welcomeTitle || "Willkommen in unserem Tennis-Club!"}
      </h2>

      {/* Welcome Description Body Text in Clean Sans */}
      <p
        id="onboarding-welcome-desc"
        className="font-sans text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md"
      >
        {welcomeDescription ||
          "Wir freuen uns, dich auf unserer modernen Plattform zu begrüßen. Bitte nimm dir kurz Zeit, deine Stammdaten zu überprüfen und bei Bedarf zu aktualisieren."}
      </p>
    </div>
  );
};

export default OnboardingHero;
