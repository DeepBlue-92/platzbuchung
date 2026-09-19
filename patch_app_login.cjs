const fs = require('fs');
const file = 'App.tsx';
let code = fs.readFileSync(file, 'utf8');

const target1 = `function App() {`;
const replacement1 = `import ChangePasswordModal from "./components/ChangePasswordModal";
function App() {`;
if (!code.includes('ChangePasswordModal')) {
  code = code.replace(target1, replacement1);
}

const target2 = `  if (!currentUser && isAuthReady) {`;
const replacement2 = `  if (currentUser && currentUser.mustChangePassword && isAuthReady) {
    return <ChangePasswordModal currentUser={currentUser} onPasswordChanged={(newPwd) => {
      setCurrentUser({...currentUser, password: newPwd, mustChangePassword: false});
    }} />;
  }

  if (!currentUser && isAuthReady) {`;

if (!code.includes('currentUser.mustChangePassword')) {
  code = code.replace(target2, replacement2);
}

fs.writeFileSync(file, code);
console.log("Patched App.tsx for password reset");
