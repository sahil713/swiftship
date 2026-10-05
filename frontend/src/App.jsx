import { Route, Routes } from "react-router-dom";
import { LayoutDashboard, Package, MapPin, UserCog, ClipboardList, Users, Tags, MessageSquare, Settings, RefreshCcw, IdCard, Truck, CheckCheck } from "lucide-react";
import PublicLayout from "./components/Layout.jsx";
import AppLayout, { RequireRole } from "./components/AppLayout.jsx";
import Home from "./pages/Home.jsx";
import Services from "./pages/Services.jsx";
import Areas from "./pages/Areas.jsx";
import Quote from "./pages/Quote.jsx";
import Track from "./pages/Track.jsx";
import Faq from "./pages/Faq.jsx";
import Contact from "./pages/Contact.jsx";
import Legal from "./pages/Legal.jsx";
import { Login, Register } from "./pages/Auth.jsx";
import OrderPage from "./pages/OrderPage.jsx";
import NotFound from "./pages/NotFound.jsx";
import AccountOrders from "./pages/account/Orders.jsx";
import AccountAddresses from "./pages/account/Addresses.jsx";
import AccountProfile from "./pages/account/Profile.jsx";
import AdminDashboard from "./pages/admin/Dashboard.jsx";
import AdminBookings from "./pages/admin/Bookings.jsx";
import AdminBooking from "./pages/admin/Booking.jsx";
import AdminCustomers, { AdminCustomer } from "./pages/admin/Customers.jsx";
import AdminPricing from "./pages/admin/Pricing.jsx";
import AdminEnquiries from "./pages/admin/Enquiries.jsx";
import AdminChangeRequests from "./pages/admin/ChangeRequests.jsx";
import AdminStaff from "./pages/admin/Staff.jsx";
import AdminSettings from "./pages/admin/Settings.jsx";
import DriverTasks from "./pages/driver/Tasks.jsx";
import DriverTask from "./pages/driver/Task.jsx";

const ACCOUNT_LINKS = [
  { to: "/account", label: "My orders", icon: Package, end: true },
  { to: "/account/addresses", label: "Saved addresses", icon: MapPin },
  { to: "/account/profile", label: "Profile", icon: UserCog },
];

const ADMIN_LINKS = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { to: "/admin/change-requests", label: "Change requests", icon: RefreshCcw },
  { to: "/admin/enquiries", label: "Enquiries", icon: MessageSquare },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/driver", label: "Driver tasks", icon: Truck },
  { section: "Configuration", roles: ["admin", "operations"] },
  { to: "/admin/pricing", label: "Services & pricing", icon: Tags },
  { to: "/admin/staff", label: "Staff & drivers", icon: IdCard },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const DRIVER_LINKS = [
  { to: "/driver", label: "My tasks", icon: Truck, end: true },
  { to: "/driver/completed", label: "Completed", icon: CheckCheck },
];

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="services" element={<Services />} />
        <Route path="areas" element={<Areas />} />
        <Route path="quote" element={<Quote />} />
        <Route path="track" element={<Track />} />
        <Route path="track/:trackingNumber" element={<Track />} />
        <Route path="faq" element={<Faq />} />
        <Route path="contact" element={<Contact />} />
        <Route path="legal/:page" element={<Legal />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="orders/:reference" element={<OrderPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<RequireRole roles={["customer"]}><AppLayout title="My account" links={ACCOUNT_LINKS} /></RequireRole>}>
        <Route path="account" element={<AccountOrders />} />
        <Route path="account/orders/:reference" element={<OrderPage embedded />} />
        <Route path="account/addresses" element={<AccountAddresses />} />
        <Route path="account/profile" element={<AccountProfile />} />
      </Route>

      <Route element={<RequireRole roles={["admin", "operations"]}><AppLayout title="Admin" links={ADMIN_LINKS} /></RequireRole>}>
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="admin/bookings" element={<AdminBookings />} />
        <Route path="admin/bookings/:reference" element={<AdminBooking />} />
        <Route path="admin/customers" element={<AdminCustomers />} />
        <Route path="admin/customers/:id" element={<AdminCustomer />} />
        <Route path="admin/pricing" element={<AdminPricing />} />
        <Route path="admin/enquiries" element={<AdminEnquiries />} />
        <Route path="admin/change-requests" element={<AdminChangeRequests />} />
        <Route path="admin/staff" element={<AdminStaff />} />
        <Route path="admin/settings" element={<AdminSettings />} />
      </Route>

      <Route element={<RequireRole roles={["driver", "operations", "admin"]}><AppLayout title="Operations" links={DRIVER_LINKS} /></RequireRole>}>
        <Route path="driver" element={<DriverTasks />} />
        <Route path="driver/completed" element={<DriverTasks completed />} />
        <Route path="driver/tasks/:id" element={<DriverTask />} />
      </Route>
    </Routes>
  );
}
