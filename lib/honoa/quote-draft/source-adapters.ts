import type { QuoteColumnMapping, QuoteSourceWorkbookConfig } from "./source-adapter-types";

const STANDARD_RISK_NOTES = [
  "成本价不是财务批准价格，只能作为 priceCandidate。",
  "报价表由财务提交和维护，出口部不能上传或维护报价表。",
  "KJ 可能存在标准编码 / 旧编码 / ERP 编码 / 孚盟编码并存，需要规范化和冲突检查。",
  "OEM / OE 可能一对多，本阶段不做自动匹配。",
  "不同品类表结构不一致，需要按 adapter 配置解析。"
];

const MULTI_CODE_MAPPING: QuoteColumnMapping = {
  kjCode: ["KJ编码", "KJ-编码", "KJ号", "KJ-编码（标准编码）", "标准编码"],
  oldCode: ["旧 KJ.NO", "原KJ.NO", "旧编码"],
  erpCode: ["（ERP） KJ-编码", "ERP KJ-编码", "鼎捷编码", "鼎捷品号"],
  fumacrmCode: ["（孚盟） KJ-编码", "孚盟 KJ-编码", "孚盟编码"],
  oemCode: ["OE", "OEM", "原厂号"],
  productName: ["品名", "产品名称", "名称"],
  model: ["车型", "车型车系", "适用车型", "英文车型", "车系"],
  specification: ["规格", "芯体", "芯体总成尺寸", "纸箱尺寸", "波距", "厚度"],
  category: ["车型类别", "自产/外购", "PA/BA", "A/B", "AT/MT"],
  costPrice: ["出口成本", "出口成本价", "出口成本报价", "出口部内销成本", "出口部内销成本价", "出口部内销成本报价"],
  quotePrice: ["报价", "单价"],
  packaging: ["纸箱尺寸", "纸箱", "包装", "包装方案成本价"],
  unit: ["单位"],
  moq: ["MOQ", "起订量"],
  notes: ["备注", "是否允限销", "能否报价", "限销备注"]
};

const RADIATOR_LIKE_MAPPING: QuoteColumnMapping = {
  ...MULTI_CODE_MAPPING,
  kjCode: ["编码", "KJ-编码（标准编码）", "KJ编码"],
  oldCode: ["旧 KJ.NO", "原KJ.NO"],
  erpCode: ["鼎捷编码", "鼎捷品号"],
  model: ["车系", "车型", "型号"],
  specification: ["规格", "芯体", "主板/水室", "纸箱", "厚度", "波距"],
  costPrice: ["出口成本报价", "出口部内销成本报价", "包装方案成本价"],
  packaging: ["纸箱(内尺寸)", "纸箱", "包装", "包装方案成本价"],
  notes: ["备注", "是否允限销", "能否报价"]
};

export const QUOTE_SOURCE_WORKBOOK_CONFIGS: QuoteSourceWorkbookConfig[] = [
  {
    id: "condenser-cost-2026",
    category: "冷凝器",
    fileNamePattern: ".*冷凝器.*成本报价表\\.(xls|xlsx)$",
    supportedFileTypes: ["xls", "xlsx"],
    submittedByRole: "finance",
    consumerDepartment: "export",
    primarySheets: [
      {
        sheetRole: "primary_cost_table",
        sheetNameHint: "2026年冷凝器成本核算",
        headerRowHint: 1,
        dataStartRowHint: 2,
        columnMapping: {
          ...MULTI_CODE_MAPPING,
          productName: ["车型车系", "品名", "产品名称"],
          specification: ["芯体总成尺寸", "纸箱尺寸", "波距", "波距代码"]
        },
        imageStrategy: "embedded_excel_image",
        priceFieldStrategy: "cost_candidate",
        riskNotes: [...STANDARD_RISK_NOTES, "嵌入图片不是稳定主图来源。"]
      }
    ],
    auxiliarySheets: [
      {
        sheetRole: "notes",
        sheetNameHint: "不能生产明细",
        headerRowHint: "detect",
        dataStartRowHint: "detect",
        columnMapping: {
          kjCode: ["KJ编码", "KJ", "KJ-编码"],
          model: ["车型", "车型车系"],
          specification: ["芯体尺寸", "芯体总成尺寸"],
          notes: ["备注", "不能生产原因"]
        },
        imageStrategy: "none",
        priceFieldStrategy: "unknown",
        riskNotes: ["不能生产明细只作为风险参考，不进入可报价主数据。"]
      }
    ]
  },
  {
    id: "heater-cost-2026",
    category: "暖风",
    fileNamePattern: ".*暖风.*成本报价表\\.(xls|xlsx)$",
    supportedFileTypes: ["xls", "xlsx"],
    submittedByRole: "finance",
    consumerDepartment: "export",
    primarySheets: [
      {
        sheetRole: "primary_cost_table",
        sheetNameHint: "2026年暖风成本核算",
        headerRowHint: 1,
        dataStartRowHint: 2,
        columnMapping: {
          ...MULTI_CODE_MAPPING,
          kjCode: ["KJ总编码", "KJ-编码", "KJ编码"],
          productName: ["适用车型", "车型类别", "英文车型"],
          model: ["适用车型", "英文车型"],
          specification: ["芯体总成尺寸", "纸箱尺寸"]
        },
        imageStrategy: "none",
        priceFieldStrategy: "cost_candidate",
        riskNotes: STANDARD_RISK_NOTES
      }
    ]
  },
  {
    id: "radiator-cost-2026",
    category: "水箱",
    fileNamePattern: ".*水箱.*成本报价表\\.(xls|xlsx)$",
    supportedFileTypes: ["xls", "xlsx"],
    submittedByRole: "finance",
    consumerDepartment: "export",
    primarySheets: [
      {
        sheetRole: "primary_cost_table",
        sheetNameHint: "2026年 水箱成本报价表",
        headerRowHint: 1,
        dataStartRowHint: 2,
        columnMapping: RADIATOR_LIKE_MAPPING,
        imageStrategy: "embedded_excel_image",
        priceFieldStrategy: "cost_candidate",
        riskNotes: [
          ...STANDARD_RISK_NOTES,
          "complex_multi_code_mapping：水箱存在基础编码、标准 KJ、旧 KJ.NO、孚盟编码、鼎捷编码等多编码来源。",
          "complex_packaging_or_spec_mapping：水箱存在多规格、多包装、纸箱内尺寸、PA/BA、A/B、AT/MT、主板/水室等字段，需要人工确认。",
          "manual_confirmation_required：水箱可以进入 V1 KJ 草稿方向，但不能静默自动匹配，必须带人工确认提示。",
          "oem_matching_deferred：水箱 OEM / OE 多在辅助 sheet，V1 不做 OEM 自动匹配。",
          "embedded_excel_image_not_stable：水箱 Excel 嵌入图片不是稳定产品主图来源。",
          "水箱主 sheet 可作为 V1 KJ 草稿候选；不能生产、只做报价不公布、不保质漏水等 sheet 不进入 V1 主草稿。"
        ]
      }
    ],
    auxiliarySheets: [
      {
        sheetRole: "notes",
        sheetNameHint: "不能生产",
        headerRowHint: "detect",
        dataStartRowHint: "detect",
        columnMapping: {
          kjCode: ["KJ", "KJ编码"],
          oemCode: ["OEM", "OE", "原厂号"],
          specification: ["DPI", "规格"],
          notes: ["备注", "不能生产原因"]
        },
        imageStrategy: "none",
        priceFieldStrategy: "unknown",
        riskNotes: ["不能生产 sheet 只作为风险拦截参考。"]
      },
      {
        sheetRole: "oem_mapping",
        sheetNameHint: "只做报价，不公布的报价表",
        headerRowHint: "detect",
        dataStartRowHint: "detect",
        columnMapping: {
          oemCode: ["OEM", "OE", "原厂号"],
          model: ["车型", "车系"],
          specification: ["DPI", "规格", "材料", "工艺", "包装"],
          notes: ["备注", "风险说明"]
        },
        imageStrategy: "none",
        priceFieldStrategy: "unknown",
        riskNotes: ["内部参考 sheet 不直接开放给出口部或客户。"]
      }
    ],
    notes: [
      "水箱 adapter 必须优先做 dry-run，不能直接导入。",
      "V1 以 KJ-编码（标准编码）为标准 KJ；旧 KJ.NO / 孚盟编码和鼎捷编码保留为别名或生产下单参考。",
      "基础 KJ 多候选时不得静默选择第一行；必须输出人工确认 warning。",
      "最新外销成本候选列和最新出口部内销成本候选列都只是成本候选，不是财务批准价格。"
    ]
  },
  {
    id: "evaporator-cost-2026",
    category: "蒸发器",
    fileNamePattern: ".*蒸发器.*成本报价表\\.(xls|xlsx)$",
    supportedFileTypes: ["xls", "xlsx"],
    submittedByRole: "finance",
    consumerDepartment: "export",
    primarySheets: [
      {
        sheetRole: "primary_cost_table",
        sheetNameHint: "2026年蒸发器成本核算",
        headerRowHint: 1,
        dataStartRowHint: 2,
        columnMapping: {
          ...MULTI_CODE_MAPPING,
          kjCode: ["KJ总编码", "KJ编码", "KJ-编码"],
          specification: ["芯体总成尺寸", "纸箱尺寸", "波距", "波距代码"]
        },
        imageStrategy: "none",
        priceFieldStrategy: "cost_candidate",
        riskNotes: STANDARD_RISK_NOTES
      }
    ]
  },
  {
    id: "intercooler-cost-2026",
    category: "中冷器",
    fileNamePattern: ".*中冷器.*成本报价表\\.(xls|xlsx)$",
    supportedFileTypes: ["xls", "xlsx"],
    submittedByRole: "finance",
    consumerDepartment: "export",
    primarySheets: [
      {
        sheetRole: "primary_cost_table",
        sheetNameHint: "2026年 中冷器成本报价表",
        headerRowHint: 1,
        dataStartRowHint: 2,
        columnMapping: RADIATOR_LIKE_MAPPING,
        imageStrategy: "embedded_excel_image",
        priceFieldStrategy: "cost_candidate",
        riskNotes: [
          ...STANDARD_RISK_NOTES,
          "complex_multi_code_mapping：中冷器存在基础编码、标准 KJ、旧 KJ.NO、孚盟编码、鼎捷品号等多编码来源。",
          "complex_packaging_or_spec_mapping：中冷器存在多规格、多包装、纸箱内尺寸、PA/BA、A/B、AT/MT、主板/水室等字段，需要人工确认。",
          "manual_confirmation_required：中冷器可以进入 V1 KJ 草稿方向，但不能静默自动匹配，必须带人工确认提示。",
          "oem_matching_deferred：中冷器 OEM / OE 多在辅助 sheet，V1 不做 OEM 自动匹配。",
          "embedded_excel_image_not_stable：中冷器 Excel 嵌入图片不是稳定产品主图来源。",
          "中冷器主 sheet 可作为 V1 KJ 草稿候选；不能生产、只做报价不公布、不保质漏水等 sheet 不进入 V1 主草稿。"
        ]
      }
    ],
    auxiliarySheets: [
      {
        sheetRole: "notes",
        sheetNameHint: "不能生产",
        headerRowHint: "detect",
        dataStartRowHint: "detect",
        columnMapping: {
          kjCode: ["KJ", "KJ编码"],
          oemCode: ["OEM", "OE", "原厂号"],
          specification: ["DPI", "规格"],
          notes: ["备注", "不能生产原因"]
        },
        imageStrategy: "none",
        priceFieldStrategy: "unknown",
        riskNotes: ["不能生产 sheet 只作为风险拦截参考。"]
      }
    ],
    notes: [
      "中冷器 adapter 必须单独验收，不能简单复用水箱导入结果。",
      "V1 以 KJ-编码（标准编码）为标准 KJ；旧 KJ.NO / 孚盟编码和鼎捷品号保留为别名或生产下单参考。",
      "基础 KJ 多候选时不得静默选择第一行；必须输出人工确认 warning。",
      "最新外销成本候选列和最新出口部内销成本候选列都只是成本候选，不是财务批准价格。"
    ]
  },
  {
    id: "water-chamber-cost-2026",
    category: "水室",
    fileNamePattern: ".*水室.*成本报价表\\.(xls|xlsx)$",
    supportedFileTypes: ["xls", "xlsx"],
    submittedByRole: "finance",
    consumerDepartment: "export",
    primarySheets: [
      {
        sheetRole: "primary_cost_table",
        sheetNameHint: "2026年5月水室成本报价表",
        headerRowHint: 2,
        dataStartRowHint: 3,
        columnMapping: {
          kjCode: ["产品KJ编码"],
          productName: ["左/上水室品名", "右/下水室品名"],
          specification: ["左/上水室规格", "右/下水室规格"],
          erpCode: ["左/上水室品号", "右/下水室品号"],
          costPrice: ["出口成本价", "出口部内销成本价"],
          notes: ["备注"]
        },
        imageStrategy: "none",
        priceFieldStrategy: "cost_candidate",
        riskNotes: [
          ...STANDARD_RISK_NOTES,
          "水室是左右件结构，不是通用整品报价主表。"
        ]
      }
    ]
  },
  {
    id: "special-packaging-cost-2026",
    category: "特殊包装及其他",
    fileNamePattern: ".*特殊包装.*其他.*成本报价表\\.(xls|xlsx)$",
    supportedFileTypes: ["xls", "xlsx"],
    submittedByRole: "finance",
    consumerDepartment: "export",
    primarySheets: [
      {
        sheetRole: "packaging",
        sheetNameHint: "2026年5月特殊包装及其他成本报价表",
        headerRowHint: 2,
        dataStartRowHint: 3,
        columnMapping: {
          productName: ["名称"],
          specification: ["规格"],
          quotePrice: ["新报价业务（在原水箱报价表增加）"],
          unit: ["单位"],
          notes: ["备注"]
        },
        imageStrategy: "none",
        priceFieldStrategy: "quote_candidate",
        riskNotes: [
          ...STANDARD_RISK_NOTES,
          "packaging_addon_not_product_line：特殊包装及其他不属于产品标准报价主线。",
          "addon_only：特殊包装及其他只能作为包装 / 附加项候选。",
          "not_product_standard_quote：特殊包装及其他不能作为产品标准报价。",
          "特殊包装及其他不能直接视为产品标准报价，只能作为包装附加项候选。",
          "该表没有稳定 KJ / OEM 主键，不适合产品自动匹配。"
        ]
      }
    ],
    notes: [
      "特殊包装 adapter 不生成产品报价候选，只生成附加项结构提示。",
      "特殊包装及其他不进入 V1 产品 KJ 草稿，只能在未来作为包装 / 附加项候选。"
    ]
  },
  {
    id: "all-aluminum-oil-cooler-cost-2026",
    category: "全铝自产机冷",
    fileNamePattern: ".*全铝.*机冷.*成本报价表\\.(xls|xlsx)$",
    supportedFileTypes: ["xls", "xlsx"],
    submittedByRole: "finance",
    consumerDepartment: "export",
    primarySheets: [
      {
        sheetRole: "primary_cost_table",
        sheetNameHint: "5月自产全铝机冷报价表",
        headerRowHint: 2,
        dataStartRowHint: 3,
        columnMapping: {
          kjCode: ["主件品名（KJ编码）"],
          productName: ["主件品名（KJ编码）", "机冷品名"],
          erpCode: ["主件品号", "机冷品号"],
          specification: ["主件规格", "机冷规格"],
          costPrice: ["出口成本价", "出口部内销成本价"]
        },
        imageStrategy: "none",
        priceFieldStrategy: "cost_candidate",
        riskNotes: [
          ...STANDARD_RISK_NOTES,
          "全铝自产机冷需要从品名中提取 KJ，可能需要单独产品线配置。"
        ]
      }
    ],
    notes: ["全铝自产机冷 adapter 不能直接套用水箱主表规则。"]
  }
];

export function getQuoteSourceWorkbookConfig(id: string) {
  return QUOTE_SOURCE_WORKBOOK_CONFIGS.find((config) => config.id === id) ?? null;
}
