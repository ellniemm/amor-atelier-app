import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

function getUsers() {
  return [
    {
      id: "1",
      name: process.env.USER1_NAME || "User 1",
      username: process.env.USER1_USERNAME,
      passwordHash: process.env.USER1_PASSWORD_HASH,
    },
    {
      id: "2",
      name: process.env.USER2_NAME || "User 2",
      username: process.env.USER2_USERNAME,
      passwordHash: process.env.USER2_PASSWORD_HASH,
    },
  ].filter((u) => u.username && u.passwordHash);
}

export const authOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Kredensial",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const users = getUsers();
        const match = users.find(
          (u) => u.username.toLowerCase() === credentials.username.toLowerCase()
        );
        if (!match) return null;

        const valid = await bcrypt.compare(credentials.password, match.passwordHash);
        if (!valid) return null;

        return { id: match.id, name: match.name, username: match.username };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username = user.username;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name;
        session.user.username = token.username;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
