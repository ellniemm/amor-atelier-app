import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pembukuan/:path*",
    "/orders/:path*",
    "/api/pembukuan/:path*",
    "/api/orders/:path*",
    "/api/report/:path*",
  ],
};
