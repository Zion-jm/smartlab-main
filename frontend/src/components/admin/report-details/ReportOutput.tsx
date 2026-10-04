import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../reportDocumentStyles.css';
import { formatPeriodLabel, type DateRange } from './reportData';

export type FixedOutputMenuPosition = {
  top: number;
  right: number;
};

function useFixedOutputMenuPosition(
  open: boolean,
  anchorRef: { current: HTMLButtonElement | null }
): FixedOutputMenuPosition | null {
  const [position, setPosition] = useState<FixedOutputMenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, open]);

  return open ? position : null;
}

export function FormalReportFrame({
  title,
  subtitle,
  range,
  className = '',
  children,
}: {
  title: string;
  subtitle: string;
  range: DateRange;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`formal-report-document report-document-paper report-detail-formal-document ${className}`}
    >
      <header className="report-document-header report-document-print-only">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="report-document-logo-frame">
              <img src="/PUPLogo.png" alt="Polytechnic University of the Philippines" className="report-document-logo" />
            </div>
            <div className="report-document-header-text">
              <p><span className="report-document-header-initial">R</span>epublic of the <span className="report-document-header-initial">P</span>hilippines</p>
              <p><span className="report-document-header-initial">P</span>olytechnic <span className="report-document-header-initial">U</span>niversity of the <span className="report-document-header-initial">P</span>hilippines</p>
              <p><span className="report-document-header-initial">O</span>ffice of the <span className="report-document-header-initial">V</span>ice <span className="report-document-header-initial">P</span>resident for <span className="report-document-header-initial">A</span>cademic <span className="report-document-header-initial">A</span>ffairs</p>
              <p>COLLEGE OF COMPUTER AND INFORMATION SCIENCES</p>
            </div>
          </div>
          <div className="report-document-code">
            <p>PUP-ITBL-3-ACAD-010</p>
            <p>REV. 1</p>
            <p>June 1, 2022</p>
          </div>
        </div>
      </header>
      <h1 className="report-document-titlebar report-document-print-only">{title}</h1>
      <div className="report-document-meta report-document-print-only">
          <p>{subtitle}</p>
          <p className="text-right">Reporting period: {formatPeriodLabel(range)}</p>
      </div>

      {children}

      <footer className="report-document-signatures report-document-print-only">
        <div>
          <p>Prepared by:</p>
          <div className="mt-8 border-b border-[#555]" />
          <p className="mt-1 italic">Laboratory Assistant</p>
        </div>
        <div>
          <p>Noted by:</p>
          <div className="mt-8 border-b border-[#555]" />
          <p className="mt-1 italic">Head, CCIS Laboratory</p>
        </div>
      </footer>
      <div className="report-document-footer report-document-print-only">
        <div>
          <p>PUP A. Mabini Campus, Anonas Street, Sta. Mesa, Manila 1016</p>
          <p>Direct Line: 335-1730 | Trunk Line: 335-1787 or 335-1777 local 000</p>
          <p>Website: www.pup.edu.ph | Email: inquire@pup.edu.ph</p>
          <p className="report-document-footer-slogan">THE COUNTRY&apos;S 1ST POLYTECHNIC U</p>
        </div>
        <img
          src="/iso-certification.png"
          alt="ISO 9001:2015 certified by SOCOTEC and IQNet"
          className="report-document-certification"
        />
      </div>
    </div>
  );
}

export type ReportPrintOption = {
  label: string;
  description: string;
  disabled: boolean;
  onSelect: () => void;
};

export function RequestReportOutputMenu({
  onPrintFullReport,
  onPrintFilteredTable,
  onPrintDemandAnalysis,
  onExportPdfFullReport,
  onExportPdfFilteredTable,
  onExportDemandPdf,
  onExportFilteredTable,
  disabled,
  demandDisabled,
}: {
  onPrintFullReport: () => void;
  onPrintFilteredTable: () => void;
  onPrintDemandAnalysis: () => void;
  onExportPdfFullReport: () => void | Promise<void>;
  onExportPdfFilteredTable: () => void | Promise<void>;
  onExportDemandPdf: () => void | Promise<void>;
  onExportFilteredTable: () => void;
  disabled: boolean;
  demandDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [focusedItem, setFocusedItem] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuPosition = useFixedOutputMenuPosition(open, anchorRef);

  const menuItems = [
    onPrintFullReport,
    onPrintFilteredTable,
    onPrintDemandAnalysis,
    onExportPdfFullReport,
    onExportPdfFilteredTable,
    onExportDemandPdf,
    onExportFilteredTable,
  ];

  useLayoutEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !menuPanelRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusedItem((current) => {
          const offset = event.key === 'ArrowDown' ? 1 : -1;
          return (current + offset + menuItems.length) % menuItems.length;
        });
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        setFocusedItem(event.key === 'Home' ? 0 : menuItems.length - 1);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuItems.length, open]);

  useLayoutEffect(() => {
    if (!open || !menuPosition) return;
    menuItemRefs.current[focusedItem]?.focus();
  }, [focusedItem, menuPosition, open]);

  const runAction = (action: () => void | Promise<void>) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setFocusedItem(0);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-full bg-[#800000] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#680000] focus:outline-none focus:ring-2 focus:ring-[#800000]/30"
      >
        Print / Export
        <span aria-hidden className="text-sm leading-none">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && menuPosition && createPortal(
        <div
          ref={menuPanelRef}
          role="menu"
          aria-label="Request report output options"
          style={{ top: menuPosition.top, right: menuPosition.right }}
          className="report-export-menu fixed z-[60] w-[min(61rem,calc(100vw-2rem))] overflow-hidden rounded-[1.25rem] border border-[#eadfdd] bg-white text-left shadow-[0_18px_45px_rgba(63,43,38,0.16)]"
        >
          <div className="grid grid-cols-1 divide-y divide-[#f1e9e7] md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="min-w-0 px-4 py-4 lg:px-6">
              <p className="pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a7770]">
                Print section
              </p>
              <button
                type="button"
                role="menuitem"
                ref={(element) => {
                  menuItemRefs.current[0] = element;
                }}
                tabIndex={focusedItem === 0 ? 0 : -1}
                onClick={() => runAction(onPrintFullReport)}
                onFocus={() => setFocusedItem(0)}
                className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none"
              >
                <span className="block">Full request log</span>
                <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                  Print every request in the selected period.
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={disabled}
                ref={(element) => {
                  menuItemRefs.current[1] = element;
                }}
                tabIndex={focusedItem === 1 ? 0 : -1}
                onClick={() => runAction(onPrintFilteredTable)}
                onFocus={() => setFocusedItem(1)}
                className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="block">Filtered request log</span>
                <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                  Print only the visible request rows.
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={demandDisabled}
                ref={(element) => {
                  menuItemRefs.current[2] = element;
                }}
                tabIndex={focusedItem === 2 ? 0 : -1}
                onClick={() => runAction(onPrintDemandAnalysis)}
                onFocus={() => setFocusedItem(2)}
                className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="block">Demand analysis</span>
                <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                  Print the current demand ranking and scope.
                </span>
              </button>
            </div>

            <div className="min-w-0 px-4 py-4 lg:px-6">
              <p className="pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a7770]">
                Export to PDF
              </p>
              <button
                type="button"
                role="menuitem"
                ref={(element) => {
                  menuItemRefs.current[3] = element;
                }}
                tabIndex={focusedItem === 3 ? 0 : -1}
                onClick={() => runAction(onExportPdfFullReport)}
                onFocus={() => setFocusedItem(3)}
                className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none"
              >
                <span className="block">Full request log</span>
                <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                  Download a server-rendered, print-quality PDF.
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={disabled}
                ref={(element) => {
                  menuItemRefs.current[4] = element;
                }}
                tabIndex={focusedItem === 4 ? 0 : -1}
                onClick={() => runAction(onExportPdfFilteredTable)}
                onFocus={() => setFocusedItem(4)}
                className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="block">Filtered request log</span>
                <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                  Download only the visible request rows as a PDF.
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={demandDisabled}
                ref={(element) => {
                  menuItemRefs.current[5] = element;
                }}
                tabIndex={focusedItem === 5 ? 0 : -1}
                onClick={() => runAction(onExportDemandPdf)}
                onFocus={() => setFocusedItem(5)}
                className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="block">Demand analysis</span>
                <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                  Download the current demand ranking as a PDF.
                </span>
              </button>
            </div>

            <div className="min-w-0 px-4 py-4 lg:px-6">
              <p className="pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a7770]">
                Export to Excel
              </p>
              <button
                type="button"
                role="menuitem"
                disabled={disabled}
                ref={(element) => {
                  menuItemRefs.current[6] = element;
                }}
                tabIndex={focusedItem === 6 ? 0 : -1}
                onClick={() => runAction(onExportFilteredTable)}
                onFocus={() => setFocusedItem(6)}
                className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="block">Request log spreadsheet</span>
                <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                  Download an Excel-compatible file from the current filters.
                </span>
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function EquipmentReportOutputMenu({
  onPrintFullReport,
  onPrintFilteredTable,
  onPrintAnalysis,
  onExportPdfFullReport,
  onExportPdfFilteredTable,
  onExportPdfAnalysis,
  onExportFilteredTable,
  onExportSectionTable,
  fullReportDisabled,
  filteredReportDisabled,
  analysisDisabled,
  sectionExportDisabled,
  pdfExporting,
}: {
  onPrintFullReport: () => void;
  onPrintFilteredTable: () => void;
  onPrintAnalysis: () => void;
  onExportPdfFullReport: () => void | Promise<void>;
  onExportPdfFilteredTable: () => void | Promise<void>;
  onExportPdfAnalysis: () => void | Promise<void>;
  onExportFilteredTable: () => void;
  onExportSectionTable: () => void;
  fullReportDisabled: boolean;
  filteredReportDisabled: boolean;
  analysisDisabled: boolean;
  sectionExportDisabled: boolean;
  pdfExporting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [focusedItem, setFocusedItem] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuPosition = useFixedOutputMenuPosition(open, anchorRef);
  const printOptions: ReportPrintOption[] = [
    {
      label: 'Full equipment log',
      description: 'Print every equipment record in the selected inventory or usage view.',
      disabled: fullReportDisabled,
      onSelect: onPrintFullReport,
    },
    {
      label: 'Filtered equipment log',
      description: 'Print all equipment records matching the current filters.',
      disabled: filteredReportDisabled,
      onSelect: onPrintFilteredTable,
    },
    {
      label: 'Equipment analysis',
      description: 'Print the current equipment ranking and its inventory or usage details.',
      disabled: analysisDisabled,
      onSelect: onPrintAnalysis,
    },
  ];
  const pdfOptions: ReportPrintOption[] = [
    {
      label: 'Full equipment log',
      description: 'Download every equipment record in the selected inventory or usage view as a PDF.',
      disabled: pdfExporting || fullReportDisabled,
      onSelect: onExportPdfFullReport,
    },
    {
      label: 'Filtered equipment log',
      description: 'Download only equipment records matching the current filters as a PDF.',
      disabled: pdfExporting || filteredReportDisabled,
      onSelect: onExportPdfFilteredTable,
    },
    {
      label: 'Equipment analysis',
      description: 'Download the current equipment ranking and inventory or usage details as a PDF.',
      disabled: pdfExporting || analysisDisabled,
      onSelect: onExportPdfAnalysis,
    },
  ];
  const excelOptions: ReportPrintOption[] = [
    {
      label: 'Equipment log spreadsheet',
      description: 'Download an Excel-compatible file from the current equipment filters.',
      disabled: filteredReportDisabled,
      onSelect: onExportFilteredTable,
    },
    ...(sectionExportDisabled
      ? []
      : [{
          label: 'Section demand spreadsheet',
          description: 'Download the current usage demand by section as an Excel-compatible file.',
          disabled: false,
          onSelect: onExportSectionTable,
        }]),
  ];
  const menuItems = [
    ...printOptions.map((option) => option.onSelect),
    ...pdfOptions.map((option) => option.onSelect),
    ...excelOptions.map((option) => option.onSelect),
  ];

  useLayoutEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !menuPanelRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusedItem((current) => {
          const offset = event.key === 'ArrowDown' ? 1 : -1;
          return (current + offset + menuItems.length) % menuItems.length;
        });
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        setFocusedItem(event.key === 'Home' ? 0 : menuItems.length - 1);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, menuItems.length]);

  useLayoutEffect(() => {
    if (open && menuPosition) menuItemRefs.current[focusedItem]?.focus();
  }, [focusedItem, menuPosition, open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setFocusedItem(0);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-full bg-[#800000] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#680000] focus:outline-none focus:ring-2 focus:ring-[#800000]/30"
      >
        Print / Export
        <span aria-hidden className="text-sm leading-none">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && menuPosition && createPortal(
        <div
          ref={menuPanelRef}
          role="menu"
          aria-label="Equipment report output options"
          style={{ top: menuPosition.top, right: menuPosition.right }}
          className="report-export-menu fixed z-[60] w-[min(61rem,calc(100vw-2rem))] overflow-hidden rounded-[1.25rem] border border-[#eadfdd] bg-white text-left shadow-[0_18px_45px_rgba(63,43,38,0.16)]"
        >
          <div className="grid grid-cols-1 divide-y divide-[#f1e9e7] md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="min-w-0 px-4 py-4 lg:px-6">
              <p className="pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a7770]">
                Print section
              </p>
              {printOptions.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  role="menuitem"
                  disabled={option.disabled}
                  ref={(element) => {
                    menuItemRefs.current[index] = element;
                  }}
                  tabIndex={focusedItem === index ? 0 : -1}
                  onClick={() => {
                    setOpen(false);
                    option.onSelect();
                  }}
                  onFocus={() => setFocusedItem(index)}
                  className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="block">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
            <div className="min-w-0 px-4 py-4 lg:px-6">
              <p className="pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a7770]">
                Export to PDF
              </p>
              {pdfOptions.map((option, index) => {
                const menuIndex = printOptions.length + index;
                return (
                  <button
                    key={option.label}
                    type="button"
                    role="menuitem"
                    disabled={option.disabled}
                    ref={(element) => {
                      menuItemRefs.current[menuIndex] = element;
                    }}
                    tabIndex={focusedItem === menuIndex ? 0 : -1}
                    onClick={() => {
                      setOpen(false);
                      option.onSelect();
                    }}
                    onFocus={() => setFocusedItem(menuIndex)}
                    className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="block">{option.label}</span>
                    <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="min-w-0 px-4 py-4 lg:px-6">
              <p className="pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a7770]">
                Export to Excel
              </p>
              {excelOptions.map((option, index) => {
                const menuIndex = printOptions.length + pdfOptions.length + index;
                return (
                  <button
                    key={option.label}
                    type="button"
                    role="menuitem"
                    disabled={option.disabled}
                    ref={(element) => {
                      menuItemRefs.current[menuIndex] = element;
                    }}
                    tabIndex={focusedItem === menuIndex ? 0 : -1}
                    onClick={() => {
                      setOpen(false);
                      option.onSelect();
                    }}
                    onFocus={() => setFocusedItem(menuIndex)}
                    className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="block">{option.label}</span>
                    <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export type SchedulePrintOption = {
  label: string;
  description: string;
  disabled: boolean;
  onSelect: () => void;
};

export type ScheduleOutputOption = SchedulePrintOption;

export function ScheduleReportOutputMenu({
  onPrintFullReport,
  onPrintFilteredTable,
  onPrintAnalysis,
  onExportPdfFullReport,
  onExportPdfFilteredTable,
  onExportPdfAnalysis,
  onExportFilteredTable,
  fullReportDisabled,
  filteredReportDisabled,
  analysisDisabled,
  pdfExporting,
}: {
  onPrintFullReport: () => void;
  onPrintFilteredTable: () => void;
  onPrintAnalysis: () => void;
  onExportPdfFullReport: () => void | Promise<void>;
  onExportPdfFilteredTable: () => void | Promise<void>;
  onExportPdfAnalysis: () => void | Promise<void>;
  onExportFilteredTable: () => void;
  fullReportDisabled: boolean;
  filteredReportDisabled: boolean;
  analysisDisabled: boolean;
  pdfExporting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [focusedItem, setFocusedItem] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuPosition = useFixedOutputMenuPosition(open, anchorRef);
  const printOptions: SchedulePrintOption[] = [
    {
      label: 'Full schedule log',
      description: 'Print every schedule in the selected reporting period.',
      disabled: fullReportDisabled,
      onSelect: onPrintFullReport,
    },
    {
      label: 'Filtered schedule log',
      description: 'Print all schedule rows matching the current filters.',
      disabled: filteredReportDisabled,
      onSelect: onPrintFilteredTable,
    },
    {
      label: 'Schedule analysis',
      description: 'Print the current section, room, and recurring-schedule analysis.',
      disabled: analysisDisabled,
      onSelect: onPrintAnalysis,
    },
  ];
  const pdfOptions: ScheduleOutputOption[] = [
    {
      label: 'Full schedule log',
      description: 'Download every schedule in the selected reporting period as a PDF.',
      disabled: pdfExporting || fullReportDisabled,
      onSelect: onExportPdfFullReport,
    },
    {
      label: 'Filtered schedule log',
      description: 'Download only schedule rows matching the current filters as a PDF.',
      disabled: pdfExporting || filteredReportDisabled,
      onSelect: onExportPdfFilteredTable,
    },
    {
      label: 'Schedule analysis',
      description: 'Download the current section, room, and recurring-schedule analysis as a PDF.',
      disabled: pdfExporting || analysisDisabled,
      onSelect: onExportPdfAnalysis,
    },
  ];
  const menuItems = [
    ...printOptions.map((option) => option.onSelect),
    ...pdfOptions.map((option) => option.onSelect),
    onExportFilteredTable,
  ];

  useLayoutEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !menuPanelRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusedItem((current) => {
          const offset = event.key === 'ArrowDown' ? 1 : -1;
          return (current + offset + menuItems.length) % menuItems.length;
        });
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        setFocusedItem(event.key === 'Home' ? 0 : menuItems.length - 1);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, menuItems.length]);

  useLayoutEffect(() => {
    if (open && menuPosition) menuItemRefs.current[focusedItem]?.focus();
  }, [focusedItem, menuPosition, open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setFocusedItem(0);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-full bg-[#800000] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#680000] focus:outline-none focus:ring-2 focus:ring-[#800000]/30"
      >
        Print / Export
        <span aria-hidden className="text-sm leading-none">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && menuPosition && createPortal(
        <div
          ref={menuPanelRef}
          role="menu"
          aria-label="Schedule report output options"
          style={{ top: menuPosition.top, right: menuPosition.right }}
          className="report-export-menu fixed z-[60] w-[min(61rem,calc(100vw-2rem))] overflow-hidden rounded-[1.25rem] border border-[#eadfdd] bg-white text-left shadow-[0_18px_45px_rgba(63,43,38,0.16)]"
        >
          <div className="grid grid-cols-1 divide-y divide-[#f1e9e7] md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="min-w-0 px-4 py-4 lg:px-6">
              <p className="pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a7770]">
                Print section
              </p>
              {printOptions.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  role="menuitem"
                  disabled={option.disabled}
                  ref={(element) => {
                    menuItemRefs.current[index] = element;
                  }}
                  tabIndex={focusedItem === index ? 0 : -1}
                  onClick={() => {
                    setOpen(false);
                    option.onSelect();
                  }}
                  onFocus={() => setFocusedItem(index)}
                  className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="block">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
            <div className="min-w-0 px-4 py-4 lg:px-6">
              <p className="pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a7770]">
                Export to PDF
              </p>
              {pdfOptions.map((option, index) => {
                const menuIndex = printOptions.length + index;
                return (
                  <button
                    key={option.label}
                    type="button"
                    role="menuitem"
                    disabled={option.disabled}
                    ref={(element) => {
                      menuItemRefs.current[menuIndex] = element;
                    }}
                    tabIndex={focusedItem === menuIndex ? 0 : -1}
                    onClick={() => {
                      setOpen(false);
                      option.onSelect();
                    }}
                    onFocus={() => setFocusedItem(menuIndex)}
                    className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="block">{option.label}</span>
                    <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="min-w-0 px-4 py-4 lg:px-6">
              <p className="pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a7770]">
                Export to Excel
              </p>
              <button
                type="button"
                role="menuitem"
                disabled={filteredReportDisabled}
                ref={(element) => {
                  menuItemRefs.current[6] = element;
                }}
                tabIndex={focusedItem === 6 ? 0 : -1}
                onClick={() => {
                  setOpen(false);
                  onExportFilteredTable();
                }}
                onFocus={() => setFocusedItem(6)}
                className="block w-full rounded-xl px-2 py-2.5 text-left text-xs font-semibold text-[#3f3636] transition hover:bg-[#fff7f5] focus:bg-[#fff7f5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="block">Schedule log spreadsheet</span>
                <span className="mt-0.5 block text-[11px] font-normal leading-4 text-[#8c8080]">
                  Download an Excel-compatible file from the current filters.
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
