import { authOptions } from "@/lib/auth";
import { s3Client } from "@/lib/digital-ocean-s3";
import { prismadb } from "@/lib/prisma";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

//Get single invoice data
export async function GET(
  request: Request,
  { params }: { params: { invoiceId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ status: 401, body: { error: "Unauthorized" } });
  }

  const { invoiceId } = params;

  if (!invoiceId) {
    return NextResponse.json({
      status: 400,
      body: { error: "Bad Request - invoice id is mandatory" },
    });
  }

  const invoice = await prismadb.invoices.findFirst({
    where: {
      id: invoiceId,
    },
  });

  if (!invoice) {
    return NextResponse.json({
      status: 404,
      body: { error: "Invoice not found" },
    });
  }

  return NextResponse.json({ invoice }, { status: 200 });
}

export async function DELETE(
  request: Request,
  { params }: { params: { invoiceId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ status: 401, body: { error: "Unauthorized" } });
  }

  const { invoiceId } = params;

  if (!invoiceId) {
    return NextResponse.json({
      status: 400,
      body: { error: "Bad Request - invoice id is mandatory" },
    });
  }

  const invoiceData = await prismadb.invoices.findFirst({
    where: {
      id: invoiceId,
    },
  });

  try {
    //Delete file from S3
    const bucketParams = {
      Bucket: process.env.DO_BUCKET,
      Key: invoiceData?.invoice_file_url?.split("/").slice(-1)[0],
    };
    await s3Client.send(new DeleteObjectCommand(bucketParams));
    console.log("Success - invoice deleted from S3 bucket");

    //Delete invoice from database
    const invoice = await prismadb.invoices.delete({
      where: {
        id: invoiceId,
      },
    });
    console.log("Invoice deleted from database", invoice);
    return NextResponse.json({ invoice }, { status: 200 });
  } catch (err) {
    console.log("Error", err);
    return NextResponse.json({
      status: 500,
      body: { error: "Something went wrong while delete invoice" },
    });
  }
}