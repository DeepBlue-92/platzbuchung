import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AdminSettings from "./components/AdminSettings";
import { DEFAULT_SETTINGS } from "./services/db";
import { Role } from "./types";
import { DEFAULT_EMAIL_TEMPLATES } from "./services/notificationTemplates";

const mockUsers = {
  admin: { name: "admin", role: Role.ADMIN, firstName: "Max", lastName: "Admin", email: "admin@test.de" },
  user1: { name: "user1", role: Role.MITGLIED, firstName: "John", lastName: "Doe", email: "john@test.de" },
};

function querySelectorPath(rootHtml: string) {
  return `<!DOCTYPE html><html><body><div id="root"><div><main><div>${rootHtml}</div></main></div></div></body></html>`;
}

async function run() {
  const fs = await import("fs");
  const tabs = ["notifications", "users", "allgemein", "arbeitseinsaetze", "rules", "sperren", "layout", "database"];
  
  for (const tab of tabs) {
    try {
      const html = renderToStaticMarkup(
        <div className="w-full flex-grow flex flex-col min-h-0">
          <div>
            <div className="w-full flex-grow flex flex-col min-h-0">
              <AdminSettings
                users={mockUsers}
                bookings={[]}
                onUpdateUsers={() => {}}
                settings={DEFAULT_SETTINGS}
                onUpdateSettings={() => {}}
                currentUser={mockUsers.admin}
                initialTab={tab}
              />
            </div>
          </div>
        </div>
      );
      fs.writeFileSync(`test_${tab}.html`, querySelectorPath(html));
      console.log(`Rendered ${tab}, length: ${html.length}`);
    } catch (e) {
      console.error(`Error in ${tab}:`, e);
    }
  }
}
run();
