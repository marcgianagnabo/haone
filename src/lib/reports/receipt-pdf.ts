import { TransactionType, type ReceiptData } from "$lib/types";
import { brandingState } from "$state/branding.svelte";
import { formatAmount, formatCurrency, formatDate } from "$utils/formatters";
import { calculateTotal } from "$utils/math";
import { parseRef } from "$utils/parsers";
import { translateMop, translatePeriod } from "$utils/translators";
import type {
  Alignment,
  Content,
  ContextPageSize,
  Margins,
  Size,
  TableCell,
  TDocumentDefinitions
} from "pdfmake/interfaces";
import { getPdfMake, imgToDataUrl } from "./pdf-utils";

/**
 * Generates and downloads a branded, selectable PDF receipt.
 * Optimized with dynamic imports for SvelteKit SSR stability.
 */
export async function exportReceiptPDF(receiptData: ReceiptData, qrDataUrl: string) {
  const pdfMake = await getPdfMake();

  const profile = brandingState.profile;
  const letterheadData = await imgToDataUrl(profile.letterheadUrl);
  const qrImage = qrDataUrl ? await imgToDataUrl(qrDataUrl) : "";

  const refInfo = parseRef(receiptData.referenceNumber);

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [72, 40, 72, 80], // 72pt = 1 inch
    background: function (
      currentPage: number,
      pageSize: ContextPageSize
    ): Content | null | undefined {
      if (currentPage === 1 && letterheadData) {
        return {
          image: letterheadData,
          width: 555.28,
          absolutePosition: { x: 20, y: 20 }
        };
      }
      return null;
    },
    content: [
      {
        text: "ACKNOWLEDGMENT RECEIPT",
        style: "header",
        alignment: "center" as Alignment,
        margin: [0, 60, 0, 20] as Margins
      },
      {
        table: {
          widths: [150, "*"] as Size[],
          body: [
            [{ text: "Issuer", bold: true }, { text: profile.issuerName }],
            [{ text: "Date Issued", bold: true }, { text: formatDate(receiptData.dateIssued) }],
            [{ text: "Payment Date", bold: true }, { text: formatDate(receiptData.paymentDate) }],
            [
              { text: "Payment Processor", bold: true },
              { text: translateMop(receiptData.processor) }
            ],
            [{ text: "Reference Number", bold: true }, { text: refInfo.reference }],
            ...(refInfo.invoice
              ? [[{ text: "InstaPay Invoice No.", bold: true }, { text: refInfo.invoice }]]
              : []),
            [{ text: "Period", bold: true }, { text: translatePeriod(receiptData.period) }],
            [{ text: "Series Number", bold: true }, { text: receiptData.seriesNumber }],
            [
              { text: "Received From", bold: true },
              { text: receiptData.receivedFrom.toUpperCase() }
            ],
            [{ text: "Received By", bold: true }, { text: receiptData.receivedBy.toUpperCase() }],
            [{ text: "Notes", bold: true }, { text: receiptData.notes || "" }]
          ] as TableCell[][]
        },
        layout: "noBorders",
        margin: [0, 0, 0, 20] as Margins
      },
      {
        table: {
          headerRows: 1,
          widths: ["*", 120] as Size[],
          body: [
            [
              {
                text: "Description",
                bold: true,
                fillColor: "#f8fafc",
                margin: [0, 5, 0, 5] as Margins
              },
              {
                text: "Amount",
                bold: true,
                fillColor: "#f8fafc",
                alignment: "right" as Alignment,
                margin: [0, 5, 0, 5] as Margins
              }
            ],
            ...receiptData.items.map(
              (item) =>
                [
                  {
                    text: [
                      { text: item.name },
                      ...(item.amount < 0
                        ? [
                            {
                              text: ` (${receiptData.transactionType === TransactionType.RECLASSIFY ? "RECLASSIFIED" : "REFUND"})`,
                              color: "#dc2626",
                              bold: true,
                              fontSize: 9
                            }
                          ]
                        : [])
                    ],
                    margin: [0, 5, 0, 5] as Margins
                  },
                  {
                    text: formatAmount(item.amount),
                    alignment: "right" as Alignment,
                    margin: [0, 5, 0, 5] as Margins
                  }
                ] as TableCell[]
            ),
            [
              {
                text: "Total Amount",
                bold: true,
                fillColor: "#f8fafc",
                alignment: "right" as Alignment,
                margin: [0, 5, 0, 5] as Margins
              },
              {
                text: formatCurrency(calculateTotal(receiptData.items)),
                bold: true,
                fillColor: "#f8fafc",
                alignment: "right" as Alignment,
                margin: [0, 5, 0, 5] as Margins
              }
            ]
          ]
        },
        layout: {
          hLineWidth: function (i: number) {
            return 0.5;
          },
          vLineWidth: () => 0,
          hLineColor: () => "#000000",
          paddingLeft: () => 9,
          paddingRight: () => 9,
          paddingTop: () => 0,
          paddingBottom: () => 0
        }
      },
      ...(receiptData.transactionType === TransactionType.WAIVED
        ? [
            {
              stack: [
                {
                  text: "Acknowledgment of Waiver of Amount",
                  bold: true,
                  italics: true,
                  margin: [0, 20, 0, 5] as Margins
                },
                {
                  text: "The above-mentioned amount has been waived for all intents and purposes, and no further claims shall be made in this regard."
                }
              ]
            }
          ]
        : [])
    ],
    footer: function (
      currentPage: number,
      pageCount: number,
      pageSize: ContextPageSize
    ): Content | null | undefined {
      return {
        stack: [
          {
            text: "This document is electronically generated, does not require a signature, and is not valid for claim of input tax.",
            alignment: "center",
            fontSize: 8
          },
          {
            text: `Generated by HAOne on ${new Date().toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true
            })}.`,
            alignment: "center",
            fontSize: 8,
            margin: [0, 2, 0, 0]
          }
        ],
        margin: [0, 20, 0, 0]
      };
    },
    images: {
      qr: qrImage || ""
    },
    styles: {
      header: {
        fontSize: 12,
        bold: true
      }
    },
    defaultStyle: {
      font: "Archivo",
      fontSize: 12
    }
  };

  if (qrImage && Array.isArray(docDefinition.content)) {
    docDefinition.content.push({
      image: "qr",
      width: 72,
      absolutePosition: { x: 500, y: 750 }
    });
  }

  pdfMake.createPdf(docDefinition).download(`Receipt_${receiptData.seriesNumber}.pdf`);
}
