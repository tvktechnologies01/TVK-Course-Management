import { env } from "../config/env";
import { HttpError } from "../middleware/error-handler";
import { AuthenticatedAccount } from "../models/user.model";

export interface SendWhatsAppOptions {
  phone: string;
  message?: string;
  templateKey?: string;
  candidateName?: string;
  candidatePosition?: string;
  actor: AuthenticatedAccount;
}

export interface SendWhatsAppResult {
  sent: boolean;
  to: string;
  templateUsed?: string;
  messageId?: string;
  note?: string;
}

export class WhatsAppService {
  isDeliveryEnabled(): boolean {
    const val = process.env.WHATSAPP_ENABLED;
    return val === "true" || val === "1" || val === "yes";
  }

  getConfig() {
    const token = process.env.WHATSAPP_TOKEN || env.whatsapp.token;
    const phoneId = process.env.WHATSAPP_PHONE_ID || env.whatsapp.phoneId;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "1848511229471912";
    return { token, phoneId, wabaId, isConfigured: Boolean(token && phoneId) };
  }

  private cachedDisplayPhone: string | null = null;
  private lastFetchTime = 0;
  private cachedTemplates: Array<{ name: string; status: string; language: string }> = [];
  private templatesLastFetch = 0;

  async fetchDisplayPhone(): Promise<string | null> {
    const config = this.getConfig();
    if (!config.isConfigured || !config.token || !config.phoneId) return null;

    if (process.env.WHATSAPP_DISPLAY_PHONE) {
      return process.env.WHATSAPP_DISPLAY_PHONE;
    }

    if (this.cachedDisplayPhone && Date.now() - this.lastFetchTime < 300000) {
      return this.cachedDisplayPhone;
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${config.phoneId}?fields=display_phone_number,verified_name&access_token=${config.token}`,
      );
      const data = (await res.json()) as { display_phone_number?: string; error?: { message: string } };
      if (data.display_phone_number) {
        this.cachedDisplayPhone = data.display_phone_number;
        this.lastFetchTime = Date.now();
        return this.cachedDisplayPhone;
      }
    } catch {
      // Ignore network errors
    }
    return null;
  }

  async getApprovedTemplates(): Promise<Array<{ name: string; status: string; language: string }>> {
    const config = this.getConfig();
    if (!config.isConfigured || !config.token || !config.wabaId) return [];

    if (this.cachedTemplates.length > 0 && Date.now() - this.templatesLastFetch < 30000) {
      return this.cachedTemplates;
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${config.wabaId}/message_templates?fields=name,status,language&access_token=${config.token}`,
      );
      const data = (await res.json()) as { data?: Array<{ name: string; status: string; language: string }> };
      if (data.data && Array.isArray(data.data)) {
        this.cachedTemplates = data.data.filter((t) => t.status === "APPROVED");
        this.templatesLastFetch = Date.now();
        return this.cachedTemplates;
      }
    } catch {
      // fallback to cache
    }
    return this.cachedTemplates;
  }

  async getStatus() {
    const config = this.getConfig();
    const isEnabled = this.isDeliveryEnabled();
    const displayPhone = await this.fetchDisplayPhone();
    const approvedTemplates = await this.getApprovedTemplates();
    return {
      configured: config.isConfigured,
      enabled: isEnabled,
      mode: isEnabled ? "live" : "test_mode",
      phoneId: config.phoneId ? `${config.phoneId.slice(0, 4)}***${config.phoneId.slice(-4)}` : null,
      fullPhoneId: config.phoneId || null,
      displayPhone: displayPhone || process.env.WHATSAPP_DISPLAY_PHONE || null,
      approvedTemplates: approvedTemplates.map((t) => t.name),
    };
  }

  formatPhoneNumber(raw: string): string {
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("0") && digits.length === 11) {
      digits = digits.slice(1);
    }
    if (digits.length === 10) {
      digits = `91${digits}`;
    }
    return digits;
  }

  async sendCandidateMessage(options: SendWhatsAppOptions): Promise<SendWhatsAppResult> {
    const { phone, message, templateKey, candidateName, candidatePosition, actor } = options;

    const formattedPhone = this.formatPhoneNumber(phone);
    if (!formattedPhone || formattedPhone.length < 10) {
      throw new HttpError(400, "PHONE_INVALID", "Invalid candidate phone number for WhatsApp.");
    }

    // Testing Mode: When WHATSAPP_ENABLED is false, simulate successful delivery without calling Meta Cloud API
    if (!this.isDeliveryEnabled()) {
      console.log(`[WHATSAPP_TEST_MODE] Simulated WhatsApp dispatch to ${formattedPhone}: "${(message || "").slice(0, 100)}"`);
      return {
        sent: true,
        to: formattedPhone,
        templateUsed: templateKey || "test_mode_simulation",
        messageId: `sim_${Date.now()}`,
        note: "WhatsApp is in test mode. Message simulated successfully without external delivery.",
      };
    }

    const config = this.getConfig();
    if (!config.isConfigured || !config.token || !config.phoneId) {
      throw new HttpError(
        400,
        "WHATSAPP_NOT_CONFIGURED",
        "Meta WhatsApp Cloud API is not configured. Please set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID in backend/.env.",
      );
    }

    const url = `https://graph.facebook.com/v21.0/${config.phoneId}/messages`;

    // Fetch live approved templates from Meta
    const approvedTemplates = await this.getApprovedTemplates();
    const approvedNames = new Set(approvedTemplates.map((t) => t.name));

    // Resolve template to use based on templateKey and Meta approval status
    let selectedTemplateName: string | null = null;
    let templateParams: string[] = [];

    const candName = (candidateName?.trim() || "Candidate").slice(0, 50);
    const candPosition = (candidatePosition?.trim() || "Position").slice(0, 50);
    const senderName = (actor.name?.trim() || "TVM Recruitment").slice(0, 50);

    const key = (templateKey || "APPLICATION_UPDATE").toUpperCase();

    if (key === "INTEGRATION_TEST") {
      selectedTemplateName = "3p_direct_integration_test_template";
    } else if (key === "APPLICATION_UPDATE") {
      if (approvedNames.has("tvm_candidate_update")) {
        selectedTemplateName = "tvm_candidate_update";
        templateParams = [candName, candPosition, senderName];
      } else if (approvedNames.has("tvm_recruitment_notification")) {
        selectedTemplateName = "tvm_recruitment_notification";
        templateParams = [candName, candPosition, senderName];
      } else if (approvedNames.has("tvm_recruitment_status")) {
        selectedTemplateName = "tvm_recruitment_status";
      } else if (approvedNames.has("3p_direct_integration_test_template")) {
        selectedTemplateName = "3p_direct_integration_test_template";
      }
    } else if (key === "INTERVIEW_INVITATION") {
      if (approvedNames.has("tvm_interview_invitation")) {
        selectedTemplateName = "tvm_interview_invitation";
        templateParams = [candName, candPosition, senderName];
      } else if (approvedNames.has("3p_direct_integration_test_template")) {
        selectedTemplateName = "3p_direct_integration_test_template";
      }
    } else if (key === "DOCUMENT_REQUEST") {
      if (approvedNames.has("tvm_document_request")) {
        selectedTemplateName = "tvm_document_request";
        templateParams = [candName, candPosition, senderName];
      } else if (approvedNames.has("3p_direct_integration_test_template")) {
        selectedTemplateName = "3p_direct_integration_test_template";
      }
    } else if (key === "CUSTOM") {
      if (approvedNames.has("3p_direct_integration_test_template")) {
        selectedTemplateName = "3p_direct_integration_test_template";
      }
    }

    // Default fallback to 3p_direct_integration_test_template if approved
    if (!selectedTemplateName && approvedNames.has("3p_direct_integration_test_template")) {
      selectedTemplateName = "3p_direct_integration_test_template";
    }

    try {
      let messageId: string | undefined;

      // 1. If an approved template is available, send as Meta template message
      if (selectedTemplateName) {
        const templatePayload: Record<string, unknown> = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "template",
          template: {
            name: selectedTemplateName,
            language: { code: "en_US" },
            ...(templateParams.length > 0
              ? {
                  components: [
                    {
                      type: "body",
                      parameters: templateParams.map((val) => ({ type: "text", text: val })),
                    },
                  ],
                }
              : {}),
          },
        };

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(templatePayload),
        });

        const data = (await response.json()) as {
          messages?: Array<{ id: string; message_status?: string }>;
          error?: {
            message: string;
            type?: string;
            code?: number;
            error_subcode?: number;
            error_data?: { details?: string };
          };
        };

        if (!response.ok || data.error) {
          let errorMsg = data.error?.message || `Meta API error (${response.status})`;
          if (data.error?.code === 190) {
            errorMsg = "Meta WhatsApp Access Token has expired. Please regenerate your permanent token.";
          } else if (data.error?.error_data?.details) {
            errorMsg += ` - ${data.error.error_data.details}`;
          }
          throw new Error(errorMsg);
        }

        messageId = data.messages?.[0]?.id;

        // If custom message text was also provided, try sending it as well (delivers if 24h window is open)
        if (message && message.trim() && selectedTemplateName === "3p_direct_integration_test_template") {
          try {
            await fetch(url, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${config.token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: formattedPhone,
                type: "text",
                text: { preview_url: false, body: message.trim() },
              }),
            });
          } catch {
            // Non-critical, template was already delivered
          }
        }

        return {
          sent: true,
          to: formattedPhone,
          templateUsed: selectedTemplateName,
          messageId,
          note: `Delivered via approved Meta template (${selectedTemplateName}).`,
        };
      }

      // 2. Fallback to free-form text if no template is available
      const textResponse = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "text",
          text: {
            preview_url: false,
            body: message || "Hello from TVM Recruitment Team",
          },
        }),
      });

      const textData = (await textResponse.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message: string; code?: number };
      };

      if (!textResponse.ok || textData.error) {
        throw new Error(textData.error?.message || `Meta API error (${textResponse.status})`);
      }

      return {
        sent: true,
        to: formattedPhone,
        messageId: textData.messages?.[0]?.id,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "WhatsApp delivery failed";
      throw new HttpError(
        502,
        "WHATSAPP_DELIVERY_FAILED",
        `Failed to send WhatsApp message to ${formattedPhone}: ${msg}`,
      );
    }
  }
}

export const whatsappService = new WhatsAppService();
