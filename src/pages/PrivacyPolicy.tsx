import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ProxCard,
  ProxCardHeader,
  ProxCardTitle,
  ProxCardContent,
} from "@/components/ProxCard";
import { ChevronLeft } from "lucide-react";

export function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-background">
      <div className="flex-1 p-4">
        <ProxCard className="w-full max-w-xl mx-auto">
          <ProxCardHeader>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/account")}
                className="p-1 rounded-full hover:bg-accent transition-colors"
                aria-label="Back"
              >
                <ChevronLeft className="h-6 w-6 text-muted-foreground" />
              </button>
              <ProxCardTitle className="text-2xl font-primary font-semibold text-black">
                Privacy Policy
              </ProxCardTitle>
            </div>
          </ProxCardHeader>
          <ProxCardContent>
            <div className="prose prose-sm max-w-none space-y-4">
              <p className="text-muted-foreground font-secondary">
                <strong>Last Updated:</strong> January 2026
              </p>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  1. Information We Collect
                </h3>
                <p className="text-muted-foreground font-secondary">
                  We collect information you provide directly to us, including your name,
                  email address, phone number, and preferred retailers. We also collect
                  information about your use of our services.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  2. How We Use Your Information
                </h3>
                <p className="text-muted-foreground font-secondary">
                  We use the information we collect to provide, maintain, and improve our
                  services, to communicate with you, and to personalize your experience.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  3. Information Sharing
                </h3>
                <p className="text-muted-foreground font-secondary">
                  We do not sell your personal information. We may share your information
                  with service providers who assist us in operating our services.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  4. Data Security
                </h3>
                <p className="text-muted-foreground font-secondary">
                  We take reasonable measures to help protect your personal information
                  from loss, theft, misuse, unauthorized access, disclosure, alteration,
                  and destruction.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  5. Your Rights
                </h3>
                <p className="text-muted-foreground font-secondary">
                  You have the right to access, update, or delete your personal
                  information at any time through your account settings.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  6. Contact Us
                </h3>
                <p className="text-muted-foreground font-secondary">
                  If you have any questions about this Privacy Policy, please contact us
                  through the feedback form in the app.
                </p>
              </section>
            </div>
          </ProxCardContent>
        </ProxCard>
      </div>
    </div>
  );
}
