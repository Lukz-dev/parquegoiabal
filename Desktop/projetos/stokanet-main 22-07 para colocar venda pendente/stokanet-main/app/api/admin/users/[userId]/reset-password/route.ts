import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getSystemAdminUser } from "@/lib/access";

function generateTemporaryPassword() {
  return randomBytes(6).toString("base64url");
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await getSystemAdminUser();
    const { userId } = await params;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isSystemAdmin: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    if (targetUser.isSystemAdmin) {
      return NextResponse.json(
        { error: "Não é possível redefinir a senha do administrador do sistema" },
        { status: 400 }
      );
    }

    const tempPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return NextResponse.json({
      success: true,
      tempPassword,
      email: targetUser.email,
    });
  } catch (error) {
    console.error("Erro ao redefinir senha do usuário:", error);
    return NextResponse.json(
      { error: "Erro interno ao redefinir a senha" },
      { status: 500 }
    );
  }
}