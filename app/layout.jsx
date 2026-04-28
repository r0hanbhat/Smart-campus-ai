import { AuthProvider } from './contexts/AuthContext.jsx';
import './globals.css';
export default function RootLayout({ children, }) {
    return (<html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>);
}
