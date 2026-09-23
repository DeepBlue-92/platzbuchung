import React from "react";
import { UserHelpModal } from "./help/UserHelpModal";

interface HelpProps {
  onBack?: () => void;
  isLoggedIn?: boolean;
  helpText?: string;
}

const Help: React.FC<HelpProps> = ({ onBack, isLoggedIn = true }) => {
  return (
    <div className="w-full h-full flex flex-col">
      <UserHelpModal
        isOpen={true}
        onBack={onBack}
        isLoggedIn={isLoggedIn}
        isModal={false}
      />
    </div>
  );
};

export default Help;

