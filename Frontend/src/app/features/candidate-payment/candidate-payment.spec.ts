import "@angular/compiler";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { Observable, of } from "rxjs";
import { CandidatePaymentComponent } from "./candidate-payment";
import { CandidatePortalService, PublicPaymentInfo } from "../../core/services/candidate-portal.service";
import { ActivatedRoute } from "@angular/router";

describe("CandidatePaymentComponent", () => {
  let component: CandidatePaymentComponent;
  let portalServiceMock: {
    getPublicPaymentDetails: ReturnType<typeof vi.fn>;
    submitPublicPaymentProof: ReturnType<typeof vi.fn>;
  };
  let routeMock: { params: Observable<any> };

  const mockPaymentInfo: PublicPaymentInfo = {
    candidateName: "Divya Ramesh",
    courseName: "Full Stack Java",
    courseDuration: "3 Months",
    totalFee: 25000,
    amountPaid: 10000,
    balance: 15000,
    paymentStatus: "Partially Paid",
    paymentInstructions: "Scan QR code or transfer to TVK account.",
    paymentQrCode: "data:image/png;base64,sampleqr",
    recentPayments: [
      {
        id: "pay-1",
        amount: 10000,
        status: "Verified",
        transactionRef: "UPI-992100",
        paidAt: new Date().toISOString(),
        receiptNumber: "RCP-2026-101",
      },
    ],
  };

  beforeEach(() => {
    portalServiceMock = {
      getPublicPaymentDetails: vi.fn().mockReturnValue(of(mockPaymentInfo)),
      submitPublicPaymentProof: vi.fn().mockReturnValue(of({ id: "pay-2", status: "Verification Pending" })),
    };

    routeMock = {
      params: of({ token: "secure-token-123" }),
    };

    component = new CandidatePaymentComponent(portalServiceMock as any, routeMock as any);
  });

  it("should load public payment info from token without requiring candidate login", () => {
    component.ngOnInit();
    expect(component.token).toBe("secure-token-123");
    expect(portalServiceMock.getPublicPaymentDetails).toHaveBeenCalledWith("secure-token-123");
    expect(component.paymentInfo?.candidateName).toBe("Divya Ramesh");
    expect(component.paymentInfo?.balance).toBe(15000);
    expect(component.amountToPay).toBe(15000);
  });

  it("should validate required fields before submitting proof", () => {
    component.ngOnInit();
    component.transactionRef = "";
    component.submitPayment();
    expect(component.errorMessage).toBe("Please enter your Transaction Reference / UTR Number.");
    expect(portalServiceMock.submitPublicPaymentProof).not.toHaveBeenCalled();
  });
});
