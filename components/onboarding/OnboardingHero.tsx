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
      className="flex flex-col justify-center text-center md:text-left space-y-3 md:space-y-3.5 pr-0 md:pr-2"
    >
      {/* Lottie Animation (Hidden on mobile < md to conserve vertical space, centered horizontally) */}
      {showAnimation && (
        <div
          id="onboarding-hero-animation-container"
          className="hidden md:flex items-center justify-center w-full max-h-[160px] h-[145px] mb-0.5 mx-auto"
        >
          {!lottieFailed && animationData ? (
            <div className="w-full max-w-[200px] h-full flex items-center justify-center mx-auto">
              <LottieComponent
                src={animationData}
                loop={true}
                autoplay={true}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          ) : !lottieFailed ? (
            <div className="w-full max-w-[200px] h-full flex items-center justify-center mx-auto">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner animate-pulse"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Sparkles className="w-7 h-7" style={{ color: primaryColor }} />
              </div>
            </div>
          ) : (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner mx-auto"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <Sparkles className="w-7 h-7" style={{ color: primaryColor }} />
            </div>
          )}
        </div>
      )}

      {/* Welcome Title in Playfair Display / Serif */}
      <h2
        id="onboarding-welcome-title"
        className="font-serif text-xl lg:text-2xl font-semibold text-slate-900 tracking-tight leading-snug"
      >
        {welcomeTitle || "Willkommen in unserem Tennis-Club!"}
      </h2>

      {/* Welcome Description Body Text in Clean Sans - Barrierefreies Dunkelgrau (#4B5563 / text-slate-600) */}
      <p
        id="onboarding-welcome-desc"
        className="font-sans text-xs sm:text-sm font-normal text-slate-600 leading-relaxed max-w-md break-words whitespace-pre-line"
      >
        {welcomeDescription ||
          "Wir freuen uns, dich auf unserer modernen Plattform zu begrüßen. Bitte nimm dir kurz Zeit, deine Stammdaten zu überprüfen und bei Bedarf zu aktualisieren."}
      </p>
    </div>
  );
};

export default OnboardingHero;
