import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmailTemplateManager } from "./components/admin/EmailTemplateManager";
import { DEFAULT_EMAIL_TEMPLATES } from "./services/notificationTemplates";
import { getDefaultTemplateLibrary, getDefaultEventAssignments } from "./services/emailTemplateStorage";

const templates = getDefaultTemplateLibrary();
const assignments = getDefaultEventAssignments(templates);
const editingTemplate = templates[0];

function querySelectorPath(rootHtml: string) {
  // Let us match Layout and AdminSettings:
  // Root: div#root
  // > div
  // > main
  // > div
  // > div
  // > div
  // > div
  // > div
  // > div (AdminSettings card)
  // > div:nth-of-type(3) (sub-panel mt-8)
  // > div:nth-of-type(1) (motion.div)
  // > div:nth-of-type(1) (AdminNotificationsManagement wrapper)
  // > div:nth-of-type(1) (space-y-6)
  // > div:nth-of-type(3) (activeSubTab === templates -> EmailTemplateManager)
  return `<!DOCTYPE html><html><body>
<div id="root">
  <div>
    <main>
      <div>
        <div>
          <div>
            <div>
              <div>
                <div>
                  <div>1</div><div>2</div>
                  <div>
                    <div>
                      <div>
                        <div>
                          <div>1</div><div>2</div>
                          ${rootHtml}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
</body></html>`;
}

async function run() {
  const fs = await import("fs");
  try {
    const html = renderToStaticMarkup(
      <EmailTemplateManager
        templates={templates}
        assignments={assignments}
        activeEditingId={editingTemplate.id}
        setActiveEditingId={() => {}}
        onUpdateTemplates={() => {}}
        onUpdateAssignments={() => {}}
        tenantColors={["#1b4332", "#c04d2b"]}
      />
    );
    fs.writeFileSync("test_designer.html", querySelectorPath(html));
    console.log("Rendered designer, length:", html.length);
  } catch (e) {
    console.error("Error in designer render:", e);
  }
}
run();
