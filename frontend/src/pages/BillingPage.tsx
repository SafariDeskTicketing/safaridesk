import React from "react";

const dummyBillingInfo = {
  plan: "Pro",
  status: "Active",
  renewalDate: "2026-03-01",
  paymentMethod: "Visa **** 4242",
  lastPayment: "$49.99",
  nextPayment: "$49.99",
};

export default function BillingPage() {
  return (
    <div className="max-w-xl mx-auto mt-10 p-8 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Billing & Subscription</h2>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Plan</span>
          <span className="font-semibold text-blue-600">{dummyBillingInfo.plan}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Status</span>
          <span className="font-semibold text-green-600">{dummyBillingInfo.status}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Renewal Date</span>
          <span className="font-semibold">{dummyBillingInfo.renewalDate}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Payment Method</span>
          <span className="font-semibold">{dummyBillingInfo.paymentMethod}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Last Payment</span>
          <span className="font-semibold">{dummyBillingInfo.lastPayment}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Next Payment</span>
          <span className="font-semibold">{dummyBillingInfo.nextPayment}</span>
        </div>
      </div>
      <button className="mt-8 w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Manage Subscription</button>
    </div>
  );
}
