import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AgentsPage from "./users/Agents";
import CustomerPage from "./users/Customers";
import RolesPage from "./users/Roles";
import AuditLogsPage from "./users/AuditLogs";

const Users: React.FC = () => {
	return (
		<section className="w-full bg-[var(--app-bg)]">
			<div className="sd-route-shell">
				<div className="sd-route-body">
					<Routes>
						<Route index element={<Navigate to="agents" replace />} />
						<Route path="agents" element={<AgentsPage />} />
						<Route path="customers" element={<CustomerPage />} />
						<Route path="roles" element={<RolesPage />} />
						<Route path="audit-logs" element={<AuditLogsPage />} />
					</Routes>
				</div>
			</div>
		</section>
	);
};

export default Users;
