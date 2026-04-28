import { Routes, Route, Navigate } from "react-router"
import { LandingPage } from "@/pages/LandingPage"
import { LoginPage } from "@/pages/LoginPage"
import { SignupPage } from "@/pages/SignupPage"
import { AuthCallbackPage } from "@/pages/AuthCallbackPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { TermsPage } from "@/pages/TermsPage"
import { PrivacyPage } from "@/pages/PrivacyPage"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { CalendarCallbackPage } from "@/pages/CalendarCallbackPage"
import { IndustryPage } from "@/pages/IndustryPage"
import { ContactPage } from "@/pages/ContactPage"
import { MarketingLayout } from "@/components/layout/MarketingLayout"
import { AppLayout } from "@/components/layout/AppLayout"
import { AppMachineProvider } from "@/pages/app/AppMachineProvider"
import { VoiceCallProvider } from "@/contexts/VoiceCallContext"
import { CallFAB } from "@/components/landing/CallFAB"
import { ScrollToTop } from "@/components/layout/ScrollToTop"
import { AppHomePage } from "@/pages/app/AppHomePage"
import { AppHowItWorksPage } from "@/pages/app/AppHowItWorksPage"
import { AppPricingPage } from "@/pages/app/AppPricingPage"
import { AppSignInPage } from "@/pages/app/AppSignInPage"
import { AppGetStartedPage } from "@/pages/app/AppGetStartedPage"

export function App() {
  return (
    <VoiceCallProvider>
      <ScrollToTop />
      <Routes>
        {/* Marketing routes */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/industries/:slug" element={<IndustryPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>

        {/* /app — XState machine owns WebGL gate + all app state */}
        <Route
          path="/app"
          element={
            <AppMachineProvider>
              <AppLayout />
            </AppMachineProvider>
          }
        >
          <Route index element={<AppHomePage />} />
          <Route path="how-it-works" element={<AppHowItWorksPage />} />
          <Route path="pricing" element={<AppPricingPage />} />
          <Route path="sign-in" element={<AppSignInPage />} />
          <Route path="get-started" element={<AppGetStartedPage />} />
        </Route>

        {/* Auth + legal */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* Signup wizard */}
        <Route path="/signup" element={<SignupPage />} />

        {/* Legacy redirect */}
        <Route path="/onboarding" element={<Navigate to="/signup" replace />} />

        {/* Calendar OAuth return */}
        <Route path="/calendar/callback" element={<ProtectedRoute><CalendarCallbackPage /></ProtectedRoute>} />
        <Route path="/calendar/microsoft/callback" element={<ProtectedRoute><CalendarCallbackPage /></ProtectedRoute>} />
        <Route path="/calendar/caldav/callback" element={<ProtectedRoute><CalendarCallbackPage /></ProtectedRoute>} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/dashboard/overview" replace /></ProtectedRoute>} />
        <Route path="/dashboard/:tab" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      </Routes>
      <CallFAB />
    </VoiceCallProvider>
  )
}
