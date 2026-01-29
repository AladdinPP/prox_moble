import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ProxCard,
  ProxCardHeader,
  ProxCardTitle,
  ProxCardContent,
} from "@/components/ProxCard";
import { ChevronLeft } from "lucide-react";

export function TermsOfService() {
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
                Terms of Service
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
                  1. Acceptance of Terms
                </h3>
                <p className="text-muted-foreground font-secondary">
                  By accessing and using Prox, you accept and agree to be bound by the
                  terms and provisions of this agreement.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  2. Use of Service
                </h3>
                <p className="text-muted-foreground font-secondary">
                  You agree to use Prox only for lawful purposes and in accordance with
                  these Terms. You are responsible for maintaining the confidentiality of
                  your account credentials.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  3. User Content
                </h3>
                <p className="text-muted-foreground font-secondary">
                  You retain all rights to the content you submit to Prox. By submitting
                  content, you grant us a license to use, modify, and display that content
                  in connection with our services.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  4. Prohibited Activities
                </h3>
                <p className="text-muted-foreground font-secondary">
                  You may not use Prox to engage in any unlawful or fraudulent activities,
                  or to violate any applicable laws or regulations.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  5. Disclaimer of Warranties
                </h3>
                <p className="text-muted-foreground font-secondary">
                  Prox is provided "as is" without warranties of any kind, either express
                  or implied. We do not guarantee that the service will be uninterrupted
                  or error-free.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  6. Limitation of Liability
                </h3>
                <p className="text-muted-foreground font-secondary">
                  Prox shall not be liable for any indirect, incidental, special,
                  consequential, or punitive damages resulting from your use of the
                  service.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  7. Changes to Terms
                </h3>
                <p className="text-muted-foreground font-secondary">
                  We reserve the right to modify these Terms at any time. Your continued
                  use of Prox after any changes constitutes acceptance of the new Terms.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold font-primary text-black">
                  8. Contact Us
                </h3>
                <p className="text-muted-foreground font-secondary">
                  If you have any questions about these Terms, please contact us through
                  the feedback form in the app.
                </p>
              </section>
            </div>
          </ProxCardContent>
        </ProxCard>
      </div>
    </div>
  );
}
