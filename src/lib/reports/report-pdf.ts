import type { ResidentRecord } from "$lib/types";
import { brandingState } from "$state/branding.svelte";
import { formatAccounting } from "$utils/formatters";
import type {
  Alignment,
  Content,
  Margins,
  Size,
  TableCell,
  TDocumentDefinitions
} from "pdfmake/interfaces";
import { getPdfMake, imgToDataUrl } from "./pdf-utils";

export interface PDFReportOptions {
  residents: (ResidentRecord & { position?: string })[];
  categoryLabel: string;
  semester: string;
  brandingKey: string;
  issuedBy: string;
  issuedByEmail: string;
  assessedBy: string;
  assessedByEmail: string;
  certifiedBy: string;
  certifiedByEmail: string;
  periodCovered: string;
  isPublic: boolean;
  isOfficerReport?: boolean;
  isAttendanceReport?: boolean;
  eventName?: string;
}

export async function exportReportPDF(options: PDFReportOptions) {
  const {
    residents,
    categoryLabel,
    semester,
    issuedBy,
    issuedByEmail,
    assessedBy,
    assessedByEmail,
    certifiedBy,
    certifiedByEmail,
    periodCovered,
    isPublic,
    isOfficerReport,
    isAttendanceReport,
    eventName
  } = options;

  const pdfMake = await getPdfMake();

  const profile = brandingState.profile;
  const letterheadData = await imgToDataUrl(profile.letterheadUrl);

  let headers: TableCell[] = [];
  let widths: Size[] = [];

  if (isAttendanceReport) {
    headers = [
      { text: "Room", style: "tableHeader" },
      { text: "Bed", style: "tableHeader" },
      { text: "Resident Name", style: "tableHeader" },
      { text: "Signature", style: "tableHeader" }
    ];
    widths = [60, 40, "*", 150];
  } else if (isOfficerReport) {
    headers = [
      { text: "Position", style: "tableHeader" },
      { text: "Name", style: "tableHeader" },
      { text: "Room", style: "tableHeader" }
    ];
    widths = [100, "*", 60];
  } else {
    headers = [
      { text: "Resident", style: "tableHeader" },
      { text: "Room", style: "tableHeader" }
    ];
    widths = ["*"];
    if (!isPublic) {
      headers.push({ text: "Bed", style: "tableHeader" });
      headers.push({ text: "Base", style: "tableHeader", alignment: "right" });
      headers.push({ text: "Paid", style: "tableHeader", alignment: "right" });
      headers.push({ text: "Waived", style: "tableHeader", alignment: "right" });
      headers.push({ text: "Balance", style: "tableHeader", alignment: "right" });
      widths.push(40, 40, 60, 60, 60, 60);
    } else {
      widths.push(100);
    }
  }

  const headerTitle = isAttendanceReport
    ? "ATTENDANCE SHEET"
    : isOfficerReport
      ? "OFFICER LIST"
      : "RESIDENT LIST";

  const subtitleText =
    isAttendanceReport || isOfficerReport
      ? semester
      : `${categoryLabel.toUpperCase()} - ${semester}`;

  const docContent: Content[] = [
    {
      text: headerTitle,
      style: "header",
      alignment: "center" as Alignment,
      margin: [0, 60, 0, 5] as Margins
    },
    {
      text: subtitleText,
      alignment: "center" as Alignment,
      margin: [0, 0, 0, isAttendanceReport ? 8 : 20] as Margins,
      fontSize: 10,
      bold: true,
      color: "#000000"
    }
  ];

  if (isAttendanceReport) {
    if (eventName) {
      docContent.push({
        text: [
          { text: "Event: ", bold: true },
          { text: eventName, decoration: "underline", bold: true }
        ],
        alignment: "center" as Alignment,
        margin: [0, 0, 0, 15] as Margins,
        fontSize: 10,
        color: "#000000"
      });
    } else {
      docContent.push({
        text: "Event: _______________________________________________________________________________",
        alignment: "left" as Alignment,
        margin: [0, 0, 0, 15] as Margins,
        fontSize: 10,
        bold: true,
        color: "#000000"
      });
    }
  }

  docContent.push({
    table: {
      headerRows: 1,
      widths: widths,
      body: [
        headers,
        ...residents.map((r) => {
          if (isAttendanceReport) {
            return [
              { text: r.room || "", fontSize: 9 },
              { text: r.bed || "", fontSize: 9 },
              { text: r.name || "", fontSize: 9 },
              { text: "", fontSize: 9 }
            ];
          }
          if (isOfficerReport) {
            return [
              { text: r.position || "", fontSize: 9, bold: true },
              { text: r.name, fontSize: 9 },
              { text: r.room, fontSize: 9 }
            ];
          }
          const row: TableCell[] = [
            { text: r.name, fontSize: 9 },
            { text: r.room, fontSize: 9 }
          ];
          if (!isPublic) {
            row.push({ text: r.bed, fontSize: 9 });
            row.push({ text: formatAccounting(r.totalBase), alignment: "right", fontSize: 9 });
            row.push({ text: formatAccounting(r.paid), alignment: "right", fontSize: 9 });
            row.push({ text: formatAccounting(r.waived), alignment: "right", fontSize: 9 });
            row.push({
              text: formatAccounting(r.bal),
              alignment: "right",
              fontSize: 9,
              bold: true
            });
          }
          return row;
        })
      ] as TableCell[][]
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#000000",
      vLineColor: () => "#000000",
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 4,
      paddingRight: () => 4
    }
  });

  docContent.push({
    margin: [0, 30, 0, 0],
    table: {
      widths: [150, "*"],
      body: [
        [
          {
            text: "Report issued by:",
            fontSize: 10
          },
          {
            text: issuedBy ? `${issuedBy} ${issuedByEmail ? `<${issuedByEmail}>` : ""}` : "—",
            fontSize: 10
          }
        ],
        [
          { text: "Assessed by:", fontSize: 10 },
          {
            text: assessedBy
              ? `${assessedBy} ${assessedByEmail ? `<${assessedByEmail}>` : ""}`
              : "—",
            fontSize: 10
          }
        ],
        [
          { text: "Certified by:", fontSize: 10 },
          {
            text: certifiedBy
              ? `${certifiedBy} ${certifiedByEmail ? `<${certifiedByEmail}>` : ""}`
              : "—",
            fontSize: 10
          }
        ],
        [
          { text: "Period Covered:", fontSize: 10 },
          { text: periodCovered, fontSize: 10 }
        ],
        [
          { text: "Date Generated:", fontSize: 10 },
          {
            text: `${new Date().toLocaleString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true
            })} (HAOne v${__APP_VERSION__}-${__COMMIT_SHA__})`,
            fontSize: 10
          }
        ]
      ]
    },
    layout: "noBorders"
  });

  if (!isAttendanceReport) {
    docContent.push({
      text: "This document is electronically generated and does not require a signature.",
      alignment: "center",
      fontSize: 10,
      margin: [0, 20, 0, 0]
    });
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [72, 40, 72, 120],
    background: function (currentPage: number): Content | null {
      if (currentPage === 1 && letterheadData) {
        return {
          image: letterheadData,
          width: 555.28,
          absolutePosition: { x: 20, y: 20 }
        };
      }
      return null;
    },
    content: docContent,
    footer: function (currentPage: number, pageCount: number): Content {
      return {
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: "right",
        fontSize: 9,
        margin: [0, 70, 72, 20]
      };
    },
    styles: {
      header: {
        fontSize: 14,
        bold: true
      },
      tableHeader: {
        bold: true,
        fontSize: 10,
        margin: [0, 2, 0, 2]
      }
    },
    defaultStyle: {
      font: "Archivo",
      fontSize: 12
    }
  };

  pdfMake
    .createPdf(docDefinition)
    .download(`Report_${categoryLabel}_${semester}${isPublic ? "_PUBLIC" : ""}.pdf`);
}
