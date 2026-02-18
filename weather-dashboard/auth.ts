import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                username: { label: 'Username', type: 'text' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) return null
                const user = await prisma.adminUser.findUnique({
                    where: { username: credentials.username as string },
                })
                if (!user) return null
                const valid = await bcrypt.compare(
                    credentials.password as string,
                    user.passwordHash
                )
                if (!valid) return null
                await prisma.adminUser.update({
                    where: { id: user.id },
                    data: { lastLogin: new Date() },
                })
                return { id: String(user.id), name: user.username }
            },
        }),
    ],
    pages: {
        signIn: '/admin/login',
    },
    session: { strategy: 'jwt' },
})
