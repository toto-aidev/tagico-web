// 互換性のため残している旧Provider。
// 分析の初期化は必ずPrivacyConsentProviderから、利用者の同意後に行う。

export default function PostHogProvider({ children }) {
  return children;
}
