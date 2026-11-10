import "@angular/compiler";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { of } from "rxjs";
import { PaymentsComponent } from "./payments";
import { PaymentRecord } from "../../core/models/candidate.model";
import { AuthService } from "../../core/services/auth.service";

describe("PaymentsComponent", () => {
  let component: PaymentsComponent;
  let candidateServiceMock: {
    getAllPayments: ReturnType<typeof vi.fn>;
    verifyPayment: ReturnType<typeof vi.fn>;
    rejectPayment: ReturnType<typeof vi.fn>;
    downloadReceipt: ReturnType<typeof vi.fn>;
    getCommonPaymentQr: ReturnType<typeof vi.fn>;
    uploadCommonPaymentQr: ReturnType<typeof vi.fn>;
  };
  let authMock: { role: "HR" | "MANAGER" };

  const mockPayments: PaymentRecord[] = [
    {
      id: "pay-1",
      candidateId: "cand-1",
      candidateName: "Aditya Kumar",
      courseName: "Full Stack Java",
      amount: 15000,
      transactionRef: "UPI-883921",
      status: "Verified",
      paidAt: new Date().toISOString(),
      receiptNumber: "RCP-2026-001",
    },
    {
      id: "pay-2",
      candidateId: "cand-2",
      candidateName: "Divya Ramesh",
      courseName: "Python Full Stack",
      amount: 10000,
      transactionRef: "UPI-771234",
      paymentProofUrl: "http://localhost:3000/proofs/pay2.jpg",
      status: "Verification Pending",
      paidAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    candidateServiceMock = {
      getAllPayments: vi.fn().mockReturnValue(of({
        items: mockPayments,
        pagination: { page: 1, pageSize: 100, total: 2, pageCount: 1 },
      })),
      verifyPayment: vi.fn().mockReturnValue(of({
        payment: { ...mockPayments[1], status: "Verified", receiptNumber: "RCP-2026-002" },
      })),
      rejectPayment: vi.fn().mockReturnValue(of({
        payment: { ...mockPayments[1], status: "Rejected", rejectionReason: "Invalid UTR" },
      })),
      downloadReceipt: vi.fn().mockReturnValue(of(new Blob(["%PDF-1.4 mock content"], { type: "application/pdf" }))),
      getCommonPaymentQr: vi.fn().mockReturnValue(of({ qrCode: "data:image/png;base64,common_qr_123" })),
      uploadCommonPaymentQr: vi.fn().mockReturnValue(of({ success: true, qrCode: "data:image/png;base64,new_common_qr" })),
    };

    authMock = { role: "HR" };
    component = new PaymentsComponent(
      candidateServiceMock as any,
      undefined,
      authMock as AuthService,
    );
  });

  it("should load payment records on init", async () => {
    await component.loadPayments();
    expect(candidateServiceMock.getAllPayments).toHaveBeenCalled();
    expect(component.payments.length).toBe(2);
    expect(component.filteredPayments.length).toBe(2);
    expect(component.loading).toBe(false);
  });

  it("should filter payments by search term and status", async () => {
    await component.loadPayments();

    component.searchQuery = "Divya";
    component.applyFilter();
    expect(component.filteredPayments.length).toBe(1);
    expect(component.filteredPayments[0].candidateName).toBe("Divya Ramesh");

    component.searchQuery = "";
    component.statusFilter = "Verified";
    component.applyFilter();
    expect(component.filteredPayments.length).toBe(1);
    expect(component.filteredPayments[0].id).toBe("pay-1");
  });

  it("keeps payment verification read-only for HR", async () => {
    await component.loadPayments();
    component.openVerifyModal(mockPayments[1]);
    expect(component.verifyingPayment).toBeNull();
    component.submitVerify();
    expect(candidateServiceMock.verifyPayment).not.toHaveBeenCalled();
  });

  it("keeps payment rejection read-only for HR", async () => {
    await component.loadPayments();
    component.openRejectModal(mockPayments[1]);
    expect(component.rejectingPayment).toBeNull();
    component.rejectionReasonInput = "Invalid UTR screenshot";
    component.submitReject();
    expect(candidateServiceMock.rejectPayment).not.toHaveBeenCalled();
  });

  it("loads every page of payment history", async () => {
    candidateServiceMock.getAllPayments.mockImplementation(({ page }: { page: number }) =>
      of(page === 1
        ? { items: [mockPayments[0]], pagination: { page: 1, pageSize: 100, total: 2, pageCount: 2 } }
        : { items: [mockPayments[1]], pagination: { page: 2, pageSize: 100, total: 2, pageCount: 2 } }),
    );

    await component.loadPayments();

    expect(candidateServiceMock.getAllPayments).toHaveBeenCalledTimes(2);
    expect(component.payments.map((payment) => payment.id)).toEqual(["pay-1", "pay-2"]);
  });

  it("allows Managers to verify pending payments", async () => {
    authMock.role = "MANAGER";
    await component.loadPayments();
    component.openVerifyModal(mockPayments[1]);

    expect(component.verifyingPayment).toBe(mockPayments[1]);
    expect(component.verifiedAmountInput).toBe(10000);
  });

  it("should switch to QR_CONTROLS tab and load official payment QR code", () => {
    component.switchTab("QR_CONTROLS");
    expect(component.activeTab).toBe("QR_CONTROLS");
    expect(candidateServiceMock.getCommonPaymentQr).toHaveBeenCalled();
    expect(component.commonPaymentQr).toBe("data:image/png;base64,common_qr_123");
  });

  it("prevents non-managers from uploading official payment QR code", () => {
    authMock.role = "HR";
    component.onCommonQrSelected({ target: { files: [new File([""], "qr.png", { type: "image/png" })] } } as any);
    expect(component.commonQrError).toContain("Unauthorized: Only Managers can replace the official payment QR code.");
    expect(candidateServiceMock.uploadCommonPaymentQr).not.toHaveBeenCalled();
  });

  it("allows managers to upload official payment QR code", () => {
    authMock.role = "MANAGER";
    const testFile = new File(["dummy image"], "qr.png", { type: "image/png" });
    const target = { files: [testFile], value: "path" };
    component.onCommonQrSelected({ target } as any);
    expect(candidateServiceMock.uploadCommonPaymentQr).toHaveBeenCalledWith(testFile);
  });
});
