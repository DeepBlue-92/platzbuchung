import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AdminSettings from "./components/AdminSettings";
import { DEFAULT_SETTINGS } from "./services/db";
import { Role } from "./types";

const mockUsers = {
  admin: { name: "admin", role: Role.ADMIN, firstName: "Max", lastName: "Admin", email: "admin@test.de" },
  user1: { name: "user1", role: Role.MITGLIED, firstName: "John", lastName: "Doe", email: "john@test.de" },
  user2: { name: "user2", role: Role.MITGLIED, firstName: "Anna", lastName: "Smith", email: "anna@test.de" },
};

function querySelectorPath(rootHtml: string, selector: string) {
  // Let's create an html wrapper
  const fullHtml = `<!DOCTYPE html><html><body><div id="root"><div><main><div>${rootHtml}</div></main></div></div></body></html>`;
  // We can write fullHtml to a file or parse it
  return fullHtml;
}

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
            initialTab="users"
          />
        </div>
      </div>
    </div>
  );
  console.log("Rendered users tab, length:", html.length);
  // Write to test_output.html
  const fs = await import("fs");
  fs.writeFileSync("test_output.html", querySelectorPath(html, ""));
  console.log("Saved test_output.html");
} catch (e) {
  console.error("Error rendering AdminSettings:", e);
}
