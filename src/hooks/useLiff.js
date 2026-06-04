import { useState, useEffect } from "react";

export function useLiff() {
  const [liff, setLiff]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady]     = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    const liffId = import.meta.env.VITE_LINE_LIFF_ID;
    if (!liffId) {
      // Dev mode — mock profile
      setProfile({ userId: "dev_user_001", displayName: "Dev User", pictureUrl: null });
      setReady(true);
      return;
    }
    import("@line/liff").then(async ({ default: liffSDK }) => {
      try {
        await liffSDK.init({ liffId });
        if (!liffSDK.isLoggedIn()) {
          liffSDK.login();
          return;
        }
        const p = await liffSDK.getProfile();
        setProfile(p);
        setLiff(liffSDK);
      } catch (e) {
        setError(e.message);
      } finally {
        setReady(true);
      }
    });
  }, []);

  return { liff, profile, ready, error };
}
