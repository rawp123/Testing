(function initializeDatabaseDiagramBuilder() {
  const SAMPLE_SCHEMA = String.raw`Table customers {
  customer_id uuid [pk, not null]
  first_name varchar(80) [not null]
  last_name varchar(80) [not null]
  email varchar(160) [not null]
  loyalty_tier varchar(24)
  created_at timestamptz [not null]
}

Table addresses {
  address_id uuid [pk, not null]
  customer_id uuid [not null, ref: > customers.customer_id]
  label varchar(40) [not null]
  street_line_1 varchar(120) [not null]
  city varchar(80) [not null]
  state_code char(2) [not null]
  postal_code varchar(16) [not null]
  is_default bool [not null]
}

Table orders {
  order_id uuid [pk, not null]
  customer_id uuid [not null, ref: > customers.customer_id]
  shipping_address_id uuid [ref: > addresses.address_id]
  order_number varchar(24) [not null]
  order_status varchar(24) [not null]
  placed_at timestamptz [not null]
  subtotal decimal(10,2) [not null]
  tax_total decimal(10,2) [not null]
  shipping_total decimal(10,2) [not null]
  grand_total decimal(10,2) [not null]
}

Table products {
  product_id uuid [pk, not null]
  sku varchar(32) [not null]
  product_name varchar(140) [not null]
  category_name varchar(80)
  unit_price decimal(10,2) [not null]
  active_flag bool [not null]
}

Table order_items {
  order_item_id uuid [pk, not null]
  order_id uuid [not null, ref: > orders.order_id]
  product_id uuid [not null, ref: > products.product_id]
  quantity int [not null]
  unit_price decimal(10,2) [not null]
  line_total decimal(10,2) [not null]
}

Table payments {
  payment_id uuid [pk, not null]
  order_id uuid [not null, ref: > orders.order_id]
  payment_method varchar(30) [not null]
  payment_status varchar(24) [not null]
  amount decimal(10,2) [not null]
  processed_at timestamptz
}

Table support_tickets {
  ticket_id uuid [pk, not null]
  customer_id uuid [not null, ref: > customers.customer_id]
  order_id uuid [ref: > orders.order_id]
  subject varchar(120) [not null]
  priority varchar(20) [not null]
  ticket_status varchar(24) [not null]
  opened_at timestamptz [not null]
  assigned_team varchar(60)
}`;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TEXT_MEASURE_FACTOR = 7.4;
  const CANVAS_SIDE_PADDING = 32;
  const MIN_DESKTOP_CANVAS_WIDTH = 1650;
  const MIN_TABLET_CANVAS_WIDTH = 1280;
  const TABLE_PADDING_X = 24;
  const TABLE_PADDING_Y = 18;
  const TABLE_HEADER_HEIGHT = 52;
  const TABLE_ROW_HEIGHT = 38;
  const TABLE_FOOTER_HEIGHT = 40;
  const BADGE_GAP = 8;
  const DEFAULT_VISIBLE_FIELD_COUNT = 4;

  function getDiagramMetrics(fontScale) {
    const scale = Math.max(0.8, Math.min(1.5, Number(fontScale) || 1));

    return {
      fontScale: scale,
      tablePaddingX: Math.round(TABLE_PADDING_X * scale),
      tablePaddingY: Math.round(TABLE_PADDING_Y * scale),
      tableHeaderHeight: Math.round(TABLE_HEADER_HEIGHT * scale),
      tableRowHeight: Math.round(TABLE_ROW_HEIGHT * scale),
      tableFooterHeight: Math.round(TABLE_FOOTER_HEIGHT * scale),
      badgeGap: Math.max(6, Math.round(BADGE_GAP * scale)),
      titleFontSize: Math.max(14, +(17 * scale).toFixed(1)),
      fieldFontSize: Math.max(12, +(14 * scale).toFixed(1)),
      typeFontSize: Math.max(10, +(12 * scale).toFixed(1)),
      toggleFontSize: Math.max(11, +(12 * scale).toFixed(1)),
      badgeFontSize: Math.max(10, +(11 * scale).toFixed(1)),
      badgeHeight: Math.max(18, Math.round(20 * scale)),
      badgeRadius: Math.max(7, Math.round(8 * scale)),
      dividerOffsetY: Math.round(8 * scale),
      headerMaskHeight: Math.round(18 * scale),
      headerTitleY: Math.round(31 * scale),
      fieldNameOffsetY: Math.round(13 * scale),
      fieldTypeOffsetY: Math.round(29 * scale),
      fieldCenterOffsetY: Math.round(18 * scale),
      footerLabelY: Math.round(26 * scale),
      minTableWidth: Math.round(520 * scale),
      maxTableWidth: Math.round(980 * scale),
      rowMinWidth: Math.round(410 * scale),
      rowWidthPadding: Math.round(112 * scale)
    };
  }

  function isLightThemeActive() {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('light-theme');
  }

  function getThemePalette() {
    if (isLightThemeActive()) {
      return {
        canvas: '#f4f8ff',
        table: '#ffffff',
        tableStroke: 'rgba(37, 99, 235, 0.16)',
        tableShadow: 'rgba(37, 99, 235, 0.08)',
        headerStart: '#2563eb',
        headerEnd: '#0ea5a9',
        headerMask: '#edf4ff',
        text: '#0f172a',
        mutedText: '#475569',
        divider: 'rgba(15, 23, 42, 0.08)',
        relationship: '#0891b2',
        relationshipDot: '#2563eb'
      };
    }

    return {
      canvas: '#08111d',
      table: '#101a2a',
      tableStroke: 'rgba(148, 163, 184, 0.22)',
      tableShadow: 'rgba(2, 6, 23, 0.22)',
      headerStart: '#1d4ed8',
      headerEnd: '#0ea5a9',
      headerMask: '#14233a',
      text: '#e6eef6',
      mutedText: '#94a3b8',
      divider: 'rgba(148, 163, 184, 0.14)',
      relationship: '#5eead4',
      relationshipDot: '#6ee7b7'
    };
  }

  function parseAttributes(attributeText) {
    if (!attributeText) {
      return [];
    }

    return attributeText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseReferenceAttribute(attributes) {
    const referenceAttribute = attributes.find((attribute) => /^ref\s*:/i.test(attribute));
    if (!referenceAttribute) {
      return null;
    }

    const match = referenceAttribute.match(/ref\s*:\s*>\s*([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)/i);
    if (!match) {
      return null;
    }

    return {
      table: match[1],
      field: match[2]
    };
  }

  function parseFieldLine(line, lineNumber) {
    const match = line.match(/^([A-Za-z_][\w]*)\s+(.+?)(?:\s+\[(.+)\])?$/);
    if (!match) {
      return {
        error: `Line ${lineNumber}: could not parse field definition "${line}".`
      };
    }

    const attributes = parseAttributes(match[3]);
    const reference = parseReferenceAttribute(attributes);

    return {
      field: {
        name: match[1],
        type: match[2].trim(),
        isPrimaryKey: attributes.some((attribute) => attribute.toLowerCase() === 'pk'),
        isNotNull: attributes.some((attribute) => attribute.toLowerCase() === 'not null'),
        reference
      }
    };
  }

  function parseDbmlSchema(input) {
    const lines = input.split(/\r?\n/);
    const tables = [];
    const errors = [];
    let currentTable = null;

    lines.forEach((rawLine, index) => {
      const lineNumber = index + 1;
      const line = rawLine.trim();

      if (!line || line.startsWith('//')) {
        return;
      }

      const tableMatch = line.match(/^Table\s+([A-Za-z_][\w]*)\s*\{$/i);
      if (tableMatch) {
        if (currentTable) {
          errors.push(`Line ${lineNumber}: new table started before closing "${currentTable.name}".`);
        }

        currentTable = {
          name: tableMatch[1],
          fields: []
        };
        tables.push(currentTable);
        return;
      }

      if (line === '}') {
        if (!currentTable) {
          errors.push(`Line ${lineNumber}: found a closing brace without an open table.`);
          return;
        }

        currentTable = null;
        return;
      }

      if (!currentTable) {
        errors.push(`Line ${lineNumber}: content must be inside a Table block.`);
        return;
      }

      const parsedField = parseFieldLine(line, lineNumber);
      if (parsedField.error) {
        errors.push(parsedField.error);
        return;
      }

      currentTable.fields.push(parsedField.field);
    });

    if (currentTable) {
      errors.push(`Table "${currentTable.name}" is missing a closing brace.`);
    }

    const relationships = [];
    const tableIndex = new Map(tables.map((table) => [table.name, table]));

    tables.forEach((table) => {
      table.fields.forEach((field) => {
        if (!field.reference) {
          return;
        }

        if (!tableIndex.has(field.reference.table)) {
          errors.push(`Reference error: ${table.name}.${field.name} points to missing table ${field.reference.table}.`);
          return;
        }

        const targetTable = tableIndex.get(field.reference.table);
        const targetField = targetTable.fields.find((candidate) => candidate.name === field.reference.field);
        if (!targetField) {
          errors.push(`Reference error: ${table.name}.${field.name} points to missing field ${field.reference.table}.${field.reference.field}.`);
          return;
        }

        relationships.push({
          fromTable: table.name,
          fromField: field.name,
          toTable: field.reference.table,
          toField: field.reference.field
        });
      });
    });

    return {
      tables,
      relationships,
      errors
    };
  }

  function computeColumnCount(tableCount) {
    if (tableCount <= 2) {
      return tableCount || 1;
    }

    if (tableCount <= 12) {
      return 3;
    }

    return 4;
  }

  function isKeyField(field) {
    return Boolean(field.isPrimaryKey || field.reference);
  }

  function getTableToggleLabel(renderState) {
    if (renderState.isExpanded) {
      return 'Show 4-field preview';
    }

    return `Show all ${renderState.totalFields} fields`;
  }

  function getTableRenderState(table, expandedTables) {
    const isExpanded = Boolean(expandedTables && expandedTables[table.name]);
    const canExpand = table.fields.length > DEFAULT_VISIBLE_FIELD_COUNT;

    if (!canExpand || isExpanded) {
      const visibleFieldIndexes = table.fields.map((_, index) => index);
      return {
        isExpanded,
        canExpand,
        totalFields: table.fields.length,
        hiddenFieldCount: 0,
        visibleFieldIndexes,
        visibleFieldIndexMap: new Map(visibleFieldIndexes.map((fieldIndex, displayIndex) => [fieldIndex, displayIndex]))
      };
    }

    const requiredFieldIndexes = new Set();
    table.fields.forEach((field, index) => {
      if (isKeyField(field)) {
        requiredFieldIndexes.add(index);
      }
    });

    const targetCount = Math.max(DEFAULT_VISIBLE_FIELD_COUNT, requiredFieldIndexes.size);
    const visibleFieldIndexes = [];

    table.fields.forEach((field, index) => {
      if (requiredFieldIndexes.has(index) || visibleFieldIndexes.length < targetCount) {
        visibleFieldIndexes.push(index);
      }
    });

    return {
      isExpanded,
      canExpand,
      totalFields: table.fields.length,
      hiddenFieldCount: Math.max(0, table.fields.length - visibleFieldIndexes.length),
      visibleFieldIndexes,
      visibleFieldIndexMap: new Map(visibleFieldIndexes.map((fieldIndex, displayIndex) => [fieldIndex, displayIndex]))
    };
  }

  function estimateTableWidth(table, metrics, renderState) {
    const nameWidth = table.name.length * 10 + 104;
    const rowWidth = renderState.visibleFieldIndexes.reduce((widest, fieldIndex) => {
      const field = table.fields[fieldIndex];
      const badgeCount = Number(field.isPrimaryKey) + Number(field.isNotNull) + Number(Boolean(field.reference));
      const badgeWidth = badgeCount * (18 + 2 * metrics.badgeFontSize) + Math.max(0, badgeCount - 1) * metrics.badgeGap;
      const textWidth = (`${field.name} ${field.type}`).length * ((TEXT_MEASURE_FACTOR + 0.6) * metrics.fontScale);
      return Math.max(widest, textWidth + badgeWidth + metrics.rowWidthPadding);
    }, metrics.rowMinWidth);

    const toggleWidth = renderState.canExpand
      ? getTableToggleLabel(renderState).length * ((TEXT_MEASURE_FACTOR + 0.8) * metrics.fontScale) + metrics.rowWidthPadding
      : 0;

    return Math.max(
      metrics.minTableWidth,
      Math.min(metrics.maxTableWidth, Math.ceil(Math.max(nameWidth * metrics.fontScale, rowWidth, toggleWidth)))
    );
  }

  function estimateTableHeight(renderState, metrics) {
    return metrics.tableHeaderHeight
      + metrics.tablePaddingY * 2
      + renderState.visibleFieldIndexes.length * metrics.tableRowHeight
      + (renderState.canExpand ? metrics.tableFooterHeight : 0);
  }

  function buildConnectivity(tables, relationships) {
    const stats = new Map();

    tables.forEach((table) => {
      stats.set(table.name, {
        inbound: 0,
        outbound: 0,
        total: 0,
        neighbors: new Set()
      });
    });

    relationships.forEach((relationship) => {
      const fromStats = stats.get(relationship.fromTable);
      const toStats = stats.get(relationship.toTable);
      if (!fromStats || !toStats) {
        return;
      }

      fromStats.outbound += 1;
      fromStats.total += 1;
      fromStats.neighbors.add(relationship.toTable);

      toStats.inbound += 1;
      toStats.total += 1;
      toStats.neighbors.add(relationship.fromTable);
    });

    return stats;
  }

  function chooseHubTable(tables, connectivity) {
    return [...tables].sort((left, right) => {
      const leftStats = connectivity.get(left.name);
      const rightStats = connectivity.get(right.name);

      if (rightStats.inbound !== leftStats.inbound) {
        return rightStats.inbound - leftStats.inbound;
      }

      if (rightStats.total !== leftStats.total) {
        return rightStats.total - leftStats.total;
      }

      if (right.fields.length !== left.fields.length) {
        return right.fields.length - left.fields.length;
      }

      return left.name.localeCompare(right.name);
    })[0];
  }

  function rankTablesForHubLayout(tables, hubName, connectivity) {
    return [...tables]
      .filter((table) => table.name !== hubName)
      .sort((left, right) => {
        const leftStats = connectivity.get(left.name);
        const rightStats = connectivity.get(right.name);
        const leftTouchesHub = leftStats.neighbors.has(hubName) ? 1 : 0;
        const rightTouchesHub = rightStats.neighbors.has(hubName) ? 1 : 0;

        if (rightTouchesHub !== leftTouchesHub) {
          return rightTouchesHub - leftTouchesHub;
        }

        if (rightStats.total !== leftStats.total) {
          return rightStats.total - leftStats.total;
        }

        if (rightStats.inbound !== leftStats.inbound) {
          return rightStats.inbound - leftStats.inbound;
        }

        return left.name.localeCompare(right.name);
      });
  }

  function applyPositionOverrides(positions, positionOverrides) {
    if (!positionOverrides) {
      return;
    }

    Object.entries(positionOverrides).forEach(([tableName, override]) => {
      if (!positions[tableName] || !override) {
        return;
      }

      positions[tableName] = {
        ...positions[tableName],
        x: typeof override.x === 'number' ? Math.max(24, override.x) : positions[tableName].x,
        y: typeof override.y === 'number' ? Math.max(32, override.y) : positions[tableName].y
      };
    });
  }

  function measureLayoutBounds(positions) {
    const frames = Object.values(positions);
    const maxRight = frames.reduce((largest, frame) => Math.max(largest, frame.x + frame.width), 0);
    const maxBottom = frames.reduce((largest, frame) => Math.max(largest, frame.y + frame.height), 0);

    return {
      width: maxRight + 48,
      height: maxBottom + 40
    };
  }

  function layoutTables(tables, relationships, positionOverrides, metrics, renderStateByName) {
    const columnCount = computeColumnCount(tables.length);
    const positions = {};
    const gapX = 132;
    const gapY = 72;
    const topPadding = 48;
    const columnWidths = new Array(columnCount).fill(0);

    const specs = tables.map((table) => ({
      name: table.name,
      width: estimateTableWidth(table, metrics, renderStateByName.get(table.name)),
      height: estimateTableHeight(renderStateByName.get(table.name), metrics)
    }));
    const specByName = new Map(specs.map((spec) => [spec.name, spec]));

    if (columnCount <= 2) {
      const columnHeights = new Array(columnCount).fill(topPadding);

      specs.forEach((spec) => {
        let bestColumn = 0;
        for (let index = 1; index < columnCount; index += 1) {
          if (columnHeights[index] < columnHeights[bestColumn]) {
            bestColumn = index;
          }
        }

        let x = 48;
        for (let index = 0; index < bestColumn; index += 1) {
          x += columnWidths[index] + gapX;
        }

        const y = columnHeights[bestColumn];
        positions[spec.name] = {
          x,
          y,
          width: spec.width,
          height: spec.height
        };

        columnHeights[bestColumn] += spec.height + gapY;
        columnWidths[bestColumn] = Math.max(columnWidths[bestColumn], spec.width);
      });

      applyPositionOverrides(positions, positionOverrides);
      const bounds = measureLayoutBounds(positions);

      return {
        positions,
        width: bounds.width,
        height: bounds.height
      };
    }

    const connectivity = buildConnectivity(tables, relationships);
    const hubTable = chooseHubTable(tables, connectivity);
    const rankedTables = rankTablesForHubLayout(tables, hubTable.name, connectivity);
    const centerColumn = Math.floor(columnCount / 2);
    const columnBuckets = new Array(columnCount).fill(null).map(() => []);

    columnBuckets[centerColumn].push(hubTable.name);

    rankedTables.forEach((table, index) => {
      const distance = Math.floor(index / 2) + 1;
      const direction = index % 2 === 0 ? -1 : 1;
      const targetColumn = Math.min(columnCount - 1, Math.max(0, centerColumn + direction * distance));
      columnBuckets[targetColumn].push(table.name);
    });

    columnBuckets.forEach((bucket, columnIndex) => {
      bucket.forEach((tableName) => {
        const spec = specByName.get(tableName);
        columnWidths[columnIndex] = Math.max(columnWidths[columnIndex], spec.width);
      });
    });

    const columnX = [];
    let runningX = 48;
    columnWidths.forEach((width, index) => {
      columnX[index] = runningX;
      runningX += width + (index < columnWidths.length - 1 ? gapX : 0);
    });

    const columnHeights = columnBuckets.map((bucket) =>
      bucket.reduce((totalHeight, tableName, index) => {
        const spec = specByName.get(tableName);
        return totalHeight + spec.height + (index < bucket.length - 1 ? gapY : 0);
      }, 0)
    );

    const tallestColumnHeight = Math.max(...columnHeights, 0);
    const columnStartY = columnHeights.map((height, index) => {
      if (index === centerColumn) {
        return topPadding;
      }

      return topPadding + Math.max(0, (tallestColumnHeight - height) / 2);
    });

    columnBuckets.forEach((bucket, columnIndex) => {
      let currentY = columnStartY[columnIndex];

      bucket.forEach((tableName) => {
        const spec = specByName.get(tableName);
        positions[tableName] = {
          x: columnX[columnIndex],
          y: currentY,
          width: spec.width,
          height: spec.height
        };
        currentY += spec.height + gapY;
      });
    });

    applyPositionOverrides(positions, positionOverrides);
    const bounds = measureLayoutBounds(positions);

    return {
      positions,
      width: bounds.width,
      height: bounds.height
    };
  }

  function createSvgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes || {}).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    return element;
  }

  function addText(parent, options) {
    const text = createSvgElement('text', {
      x: options.x,
      y: options.y,
      fill: options.fill || '#e6eef6',
      'font-size': options.fontSize || 14,
      'font-family': options.fontFamily || 'Inter, system-ui, sans-serif',
      'font-weight': options.fontWeight || 500
    });
    text.textContent = options.value;
    parent.appendChild(text);
    return text;
  }

  function addBadge(parent, x, y, label, fill, metrics) {
    const badgeWidth = Math.round(18 + label.length * (metrics.badgeFontSize * 0.95 + 2));
    const group = createSvgElement('g');
    const rect = createSvgElement('rect', {
      x,
      y,
      rx: metrics.badgeRadius,
      ry: metrics.badgeRadius,
      width: badgeWidth,
      height: metrics.badgeHeight,
      fill
    });
    const text = createSvgElement('text', {
      x: x + badgeWidth / 2,
      y: y + metrics.badgeHeight * 0.7,
      'text-anchor': 'middle',
      'font-size': metrics.badgeFontSize,
      'font-family': 'Inter, system-ui, sans-serif',
      'font-weight': 700,
      fill: '#06111f'
    });
    text.textContent = label;
    group.appendChild(rect);
    group.appendChild(text);
    parent.appendChild(group);
    return badgeWidth;
  }

  function buildTableShapes(svg, table, frame, palette, metrics, renderState) {
    const group = createSvgElement('g', {
      transform: `translate(${frame.x}, ${frame.y})`,
      class: 'db-table-node',
      'data-table-name': table.name
    });
    const shadow = createSvgElement('rect', {
      class: 'db-table-shadow',
      x: 0,
      y: 6,
      width: frame.width,
      height: frame.height,
      rx: 18,
      ry: 18,
      fill: palette.tableShadow
    });
    const card = createSvgElement('rect', {
      class: 'db-table-card',
      x: 0,
      y: 0,
      width: frame.width,
      height: frame.height,
      rx: 18,
      ry: 18,
      fill: palette.table,
      stroke: palette.tableStroke,
      'stroke-width': 1.2
    });
    const header = createSvgElement('rect', {
      class: 'db-table-header',
      x: 0,
      y: 0,
      width: frame.width,
      height: metrics.tableHeaderHeight,
      rx: 18,
      ry: 18,
      fill: 'url(#tableHeaderGradient)'
    });
    const headerMask = createSvgElement('rect', {
      x: 0,
      y: metrics.tableHeaderHeight - metrics.headerMaskHeight,
      width: frame.width,
      height: metrics.headerMaskHeight,
      fill: palette.headerMask
    });

    group.appendChild(shadow);
    group.appendChild(card);
    group.appendChild(header);
    group.appendChild(headerMask);

    addText(group, {
      x: metrics.tablePaddingX,
      y: metrics.headerTitleY,
      value: table.name,
      fontSize: metrics.titleFontSize,
      fontWeight: 700,
      fill: '#f8fbff'
    });

    renderState.visibleFieldIndexes.forEach((fieldIndex, displayIndex) => {
      const field = table.fields[fieldIndex];
      const rowY = metrics.tableHeaderHeight + metrics.tablePaddingY + displayIndex * metrics.tableRowHeight;
      const line = createSvgElement('line', {
        x1: 0,
        y1: rowY - metrics.dividerOffsetY,
        x2: frame.width,
        y2: rowY - metrics.dividerOffsetY,
        stroke: palette.divider,
        'stroke-width': 1
      });
      group.appendChild(line);

      addText(group, {
        x: metrics.tablePaddingX,
        y: rowY + metrics.fieldNameOffsetY,
        value: field.name,
        fontSize: metrics.fieldFontSize,
        fontWeight: field.isPrimaryKey ? 700 : 600,
        fill: palette.text
      });

      addText(group, {
        x: metrics.tablePaddingX,
        y: rowY + metrics.fieldTypeOffsetY,
        value: field.type,
        fontSize: metrics.typeFontSize,
        fill: palette.mutedText,
        fontWeight: 500
      });

      let badgeX = frame.width - metrics.tablePaddingX;
      const badges = [];
      if (field.reference) {
        badges.push({ label: 'FK', fill: '#60a5fa' });
      }
      if (field.isPrimaryKey) {
        badges.push({ label: 'PK', fill: '#6ee7b7' });
      }
      if (field.isNotNull) {
        badges.push({ label: 'NN', fill: '#fbbf24' });
      }

      badges.reverse().forEach((badge) => {
        const badgeWidth = Math.round(18 + badge.label.length * (metrics.badgeFontSize * 0.95 + 2));
        badgeX -= badgeWidth;
        addBadge(group, badgeX, rowY + Math.round(7 * metrics.fontScale), badge.label, badge.fill, metrics);
        badgeX -= metrics.badgeGap;
      });
    });

    if (renderState.canExpand) {
      const footerY = frame.height - metrics.tableFooterHeight;
      const footerDivider = createSvgElement('line', {
        x1: 0,
        y1: footerY,
        x2: frame.width,
        y2: footerY,
        stroke: palette.divider,
        'stroke-width': 1
      });
      const toggleGroup = createSvgElement('g', {
        'data-table-toggle': 'true',
        'data-table-name': table.name,
        cursor: 'pointer'
      });
      const toggleRect = createSvgElement('rect', {
        class: 'db-table-toggle-rect',
        x: 10,
        y: footerY + 8,
        width: frame.width - 20,
        height: metrics.tableFooterHeight - 16,
        rx: 12,
        ry: 12,
        fill: isLightThemeActive() ? 'rgba(37, 99, 235, 0.08)' : 'rgba(96, 165, 250, 0.12)',
        stroke: isLightThemeActive() ? 'rgba(37, 99, 235, 0.12)' : 'rgba(148, 163, 184, 0.16)',
        'stroke-width': 1
      });

      toggleGroup.appendChild(toggleRect);
      addText(toggleGroup, {
        x: frame.width / 2,
        y: footerY + metrics.footerLabelY,
        value: getTableToggleLabel(renderState),
        fontSize: metrics.toggleFontSize,
        fontWeight: 700,
        fill: palette.relationship,
        fontFamily: 'Inter, system-ui, sans-serif'
      }).setAttribute('class', 'db-table-toggle-text');
      toggleGroup.lastChild.setAttribute('text-anchor', 'middle');

      if (!renderState.isExpanded && renderState.hiddenFieldCount > 0) {
        addText(toggleGroup, {
          x: frame.width - metrics.tablePaddingX,
          y: footerY + metrics.footerLabelY,
          value: `+${renderState.hiddenFieldCount}`,
          fontSize: metrics.toggleFontSize,
          fontWeight: 700,
          fill: palette.mutedText
        }).setAttribute('class', 'db-table-toggle-count');
        toggleGroup.lastChild.setAttribute('text-anchor', 'end');
      }

      group.appendChild(footerDivider);
      group.appendChild(toggleGroup);
    }

    svg.appendChild(group);
    return group;
  }

  function getFieldCenter(frame, renderState, rowIndex, side, metrics) {
    const displayIndex = renderState.visibleFieldIndexMap.get(rowIndex);
    const y = displayIndex === undefined
      ? frame.y + frame.height - (renderState.canExpand ? metrics.tableFooterHeight / 2 : metrics.tablePaddingY)
      : frame.y + metrics.tableHeaderHeight + metrics.tablePaddingY + displayIndex * metrics.tableRowHeight + metrics.fieldCenterOffsetY;
    const x = side === 'left' ? frame.x : frame.x + frame.width;
    return { x, y };
  }

  function buildOrthogonalPath(start, end, fromSide, toSide) {
    const outwardOffset = 28;
    const startBendX = start.x + (fromSide === 'right' ? outwardOffset : -outwardOffset);
    const endBendX = end.x + (toSide === 'left' ? -outwardOffset : outwardOffset);
    const horizontalClearance = fromSide === 'right'
      ? endBendX - startBendX
      : startBendX - endBendX;
    const points = [
      start,
      { x: startBendX, y: start.y }
    ];

    if (horizontalClearance >= 24) {
      const midX = (startBendX + endBendX) / 2;
      points.push(
        { x: midX, y: start.y },
        { x: midX, y: end.y }
      );
    } else {
      const deltaY = end.y - start.y;
      const midY = Math.abs(deltaY) >= 16
        ? start.y + deltaY / 2
        : start.y + (start.y <= end.y ? 40 : -40);
      points.push(
        { x: startBendX, y: midY },
        { x: endBendX, y: midY }
      );
    }

    points.push(
      { x: endBendX, y: end.y },
      end
    );

    const deduped = points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
    return deduped.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  }

  function updateRelationshipPath(connection, layout, metrics, renderStateByName) {
    const fromFrame = layout.positions[connection.fromTable];
    const toFrame = layout.positions[connection.toTable];
    const fromRenderState = renderStateByName.get(connection.fromTable);
    const toRenderState = renderStateByName.get(connection.toTable);
    const fromSide = fromFrame.x <= toFrame.x ? 'right' : 'left';
    const toSide = fromSide === 'right' ? 'left' : 'right';
    const start = getFieldCenter(fromFrame, fromRenderState, connection.fromRowIndex, fromSide, metrics);
    const end = getFieldCenter(toFrame, toRenderState, connection.toRowIndex, toSide, metrics);

    connection.path.setAttribute('d', buildOrthogonalPath(start, end, fromSide, toSide));
    connection.startDot.setAttribute('cx', String(start.x));
    connection.startDot.setAttribute('cy', String(start.y));
    connection.endDot.setAttribute('cx', String(end.x));
    connection.endDot.setAttribute('cy', String(end.y));
  }

  function buildRelationshipPaths(svg, diagram, layout, palette, metrics, renderStateByName) {
    const connections = [];

    diagram.relationships.forEach((relationship) => {
      const fromTable = diagram.tables.find((table) => table.name === relationship.fromTable);
      const toTable = diagram.tables.find((table) => table.name === relationship.toTable);
      if (!fromTable || !toTable) {
        return;
      }

      const fromRowIndex = fromTable.fields.findIndex((field) => field.name === relationship.fromField);
      const toRowIndex = toTable.fields.findIndex((field) => field.name === relationship.toField);
      const group = createSvgElement('g', {
        class: 'db-relationship'
      });
      const path = createSvgElement('path', {
        class: 'db-relationship-path',
        fill: 'none',
        stroke: palette.relationship,
        'stroke-width': 2.2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-opacity': 0.92,
        'marker-end': 'url(#arrowhead)'
      });
      const startDot = createSvgElement('circle', {
        class: 'db-relationship-dot',
        cx: 0,
        cy: 0,
        r: 4,
        fill: palette.relationshipDot
      });
      const endDot = createSvgElement('circle', {
        class: 'db-relationship-dot',
        cx: 0,
        cy: 0,
        r: 4,
        fill: palette.relationshipDot
      });

      group.appendChild(path);
      group.appendChild(startDot);
      group.appendChild(endDot);
      svg.appendChild(group);
      const connection = {
        relationship,
        fromTable: relationship.fromTable,
        toTable: relationship.toTable,
        fromRowIndex,
        toRowIndex,
        group,
        path,
        startDot,
        endDot
      };
      updateRelationshipPath(connection, layout, metrics, renderStateByName);
      connections.push(connection);
    });

    return connections;
  }

  function buildDefinitions(svg, palette) {
    const defs = createSvgElement('defs');
    const gradient = createSvgElement('linearGradient', {
      id: 'tableHeaderGradient',
      x1: '0%',
      y1: '0%',
      x2: '100%',
      y2: '100%'
    });
    gradient.appendChild(createSvgElement('stop', { offset: '0%', 'stop-color': palette.headerStart }));
    gradient.appendChild(createSvgElement('stop', { offset: '100%', 'stop-color': palette.headerEnd }));

    const marker = createSvgElement('marker', {
      id: 'arrowhead',
      markerWidth: 10,
      markerHeight: 10,
      refX: 7,
      refY: 3.5,
      orient: 'auto',
      markerUnits: 'strokeWidth'
    });
    marker.appendChild(createSvgElement('path', {
      d: 'M0,0 L0,7 L7,3.5 z',
      fill: palette.relationship
    }));

    defs.appendChild(gradient);
    defs.appendChild(marker);
    svg.appendChild(defs);
  }

  function getMinimumCanvasWidth(stageWidth) {
    if (stageWidth >= 1200) {
      return Math.max(MIN_DESKTOP_CANVAS_WIDTH, stageWidth + 320);
    }

    if (stageWidth >= 820) {
      return Math.max(MIN_TABLET_CANVAS_WIDTH, stageWidth + 220);
    }

    return Math.max(980, stageWidth + 140);
  }

  function renderDiagram(diagram, stageWidth, positionOverrides, fontScale, expandedTables) {
    if (!diagram.tables.length) {
      throw new Error('No tables were found in the schema.');
    }

    const palette = getThemePalette();
    const metrics = getDiagramMetrics(fontScale);
    const renderStateByName = new Map(diagram.tables.map((table) => [table.name, getTableRenderState(table, expandedTables)]));
    const layout = layoutTables(diagram.tables, diagram.relationships, positionOverrides, metrics, renderStateByName);
    const canvasWidth = Math.max(layout.width, getMinimumCanvasWidth(stageWidth || 0));
    const canvasHeight = layout.height;
    const svg = createSvgElement('svg', {
      xmlns: SVG_NS,
      width: canvasWidth,
      height: canvasHeight,
      viewBox: `0 0 ${canvasWidth} ${canvasHeight}`,
      class: 'db-rendered-diagram',
      role: 'img',
      'aria-label': 'Database diagram'
    });

    buildDefinitions(svg, palette);
    const backgroundRect = createSvgElement('rect', {
      class: 'db-canvas-background',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      fill: palette.canvas
    });
    svg.appendChild(backgroundRect);

    const connections = buildRelationshipPaths(svg, diagram, layout, palette, metrics, renderStateByName);
    const tableGroups = new Map();
    diagram.tables.forEach((table) => {
      tableGroups.set(table.name, buildTableShapes(svg, table, layout.positions[table.name], palette, metrics, renderStateByName.get(table.name)));
    });
    return {
      svg,
      layout,
      connections,
      tableGroups,
      renderStateByName,
      metrics,
      backgroundRect,
      minimumCanvasWidth: getMinimumCanvasWidth(stageWidth || 0)
    };
  }

  function serializeSvg(svg) {
    return new XMLSerializer().serializeToString(svg);
  }

  function downloadTextFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadSvg(svg) {
    downloadTextFile('database-diagram.svg', serializeSvg(svg), 'image/svg+xml;charset=utf-8');
  }

  function downloadDbml(schemaText) {
    downloadTextFile('database-schema.dbml', schemaText, 'text/plain;charset=utf-8');
  }

  function downloadPng(svg) {
    return new Promise((resolve, reject) => {
      const svgMarkup = serializeSvg(svg);
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const image = new Image();

      image.onload = () => {
        const width = Number(svg.getAttribute('width'));
        const height = Number(svg.getAttribute('height'));
        const canvas = document.createElement('canvas');
        const scale = window.devicePixelRatio > 1 ? 2 : 1;
        canvas.width = width * scale;
        canvas.height = height * scale;
        const context = canvas.getContext('2d');

        if (!context) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas export is not available in this browser.'));
          return;
        }

        context.scale(scale, scale);
        context.fillStyle = '#08111d';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(url);

        canvas.toBlob((pngBlob) => {
          if (!pngBlob) {
            reject(new Error('PNG export failed.'));
            return;
          }

          const pngUrl = URL.createObjectURL(pngBlob);
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = 'database-diagram.png';
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(pngUrl);
          resolve();
        }, 'image/png');
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('PNG export failed.'));
      };

      image.src = url;
    });
  }

  function updateErrorPanel(messages, elements) {
    elements.errorList.innerHTML = '';

    if (!messages.length) {
      elements.errorPanel.hidden = true;
      return;
    }

    messages.forEach((message) => {
      const item = document.createElement('li');
      item.textContent = message;
      elements.errorList.appendChild(item);
    });

    elements.errorPanel.hidden = false;
  }

  function extractErrorLineDetails(messages, lineCount) {
    const errorLines = new Set();
    const contextLines = new Set();

    messages.forEach((message) => {
      const match = message.match(/Line\s+(\d+)/i);
      if (!match) {
        return;
      }

      const lineNumber = Number(match[1]);
      if (!Number.isFinite(lineNumber) || lineNumber < 1) {
        return;
      }

      errorLines.add(lineNumber);
      if (lineNumber > 1) {
        contextLines.add(lineNumber - 1);
      }
      if (lineNumber < lineCount) {
        contextLines.add(lineNumber + 1);
      }
    });

    errorLines.forEach((lineNumber) => contextLines.delete(lineNumber));

    return {
      errorLines,
      contextLines
    };
  }

  function mountDiagram(stage, svg, emptyState) {
    stage.innerHTML = '';
    if (svg) {
      const viewport = document.createElement('div');
      viewport.className = 'db-diagram-viewport';
      viewport.appendChild(svg);
      stage.appendChild(viewport);
      return;
    }

    stage.appendChild(emptyState);
  }

  function initializePage() {
    const schemaInput = document.getElementById('schema-input');
    if (!schemaInput) {
      return;
    }

    const elements = {
      schemaInput,
      schemaEditor: document.getElementById('schema-editor'),
      lineNumbers: document.getElementById('line-numbers'),
      schemaHighlights: document.getElementById('schema-highlights'),
      schemaBody: document.getElementById('schema-body'),
      collapsedBar: document.getElementById('schema-collapsed-bar'),
      tableCount: document.getElementById('table-count'),
      relationshipCount: document.getElementById('relationship-count'),
      status: document.getElementById('schema-status'),
      errorPanel: document.getElementById('error-panel'),
      errorList: document.getElementById('error-list'),
      stage: document.getElementById('diagram-stage'),
      emptyState: document.getElementById('diagram-empty-state'),
      selectionState: document.getElementById('table-selection-state'),
      tableSearchInput: document.getElementById('table-search'),
      tableSearchOptions: document.getElementById('table-search-options'),
      jumpTableButton: document.getElementById('jump-table'),
      zoomOutButton: document.getElementById('zoom-out'),
      zoomInButton: document.getElementById('zoom-in'),
      zoomFitButton: document.getElementById('zoom-fit'),
      zoomResetButton: document.getElementById('zoom-reset'),
      zoomValue: document.getElementById('zoom-value'),
      fontScaleInput: document.getElementById('font-scale'),
      fontScaleValue: document.getElementById('font-scale-value'),
      renderButton: document.getElementById('render-diagram'),
      loadSampleButton: document.getElementById('load-sample'),
      clearButton: document.getElementById('clear-schema'),
      editSchemaButton: document.getElementById('edit-schema'),
      editSchemaSecondaryButton: document.getElementById('edit-schema-secondary'),
      downloadDbmlButton: document.getElementById('download-dbml'),
      downloadPngButton: document.getElementById('download-png'),
      downloadButton: document.getElementById('download-svg')
    };

    let currentSvg = null;
    let currentParsed = null;
    let currentLayout = null;
    let currentConnections = [];
    let currentTableGroups = new Map();
    let currentManualPositions = {};
    let currentRenderStateByName = new Map();
    let currentExpandedTables = {};
    let currentSelectedTableName = null;
    let currentMetrics = getDiagramMetrics(1);
    let currentZoom = 1;
    let currentFontScale = 1;
    let currentBackgroundRect = null;
    let currentMinimumCanvasWidth = MIN_TABLET_CANVAS_WIDTH;
    let resizeFrame = null;
    let panState = null;
    let dragState = null;
    let suppressSelectionClick = false;
    let currentEditorErrorMeta = extractErrorLineDetails([], 1);

    function getViewport() {
      return elements.stage.querySelector('.db-diagram-viewport');
    }

    function updateZoomDisplay() {
      elements.zoomValue.textContent = `${Math.round(currentZoom * 100)}%`;
    }

    function syncSchemaEditorScroll() {
      elements.lineNumbers.scrollTop = elements.schemaInput.scrollTop;
      elements.schemaHighlights.scrollTop = elements.schemaInput.scrollTop;
      elements.schemaHighlights.scrollLeft = elements.schemaInput.scrollLeft;
    }

    function renderSchemaEditorDecorations(messages) {
      const lines = elements.schemaInput.value.split(/\r?\n/);
      const safeLines = lines.length ? lines : [''];
      const lineCount = safeLines.length;
      currentEditorErrorMeta = extractErrorLineDetails(messages || [], lineCount);

      const lineNumberFragment = document.createDocumentFragment();
      const highlightFragment = document.createDocumentFragment();

      safeLines.forEach((lineText, index) => {
        const lineNumber = index + 1;
        const lineNumberElement = document.createElement('span');
        lineNumberElement.className = 'db-line-number';
        if (currentEditorErrorMeta.errorLines.has(lineNumber)) {
          lineNumberElement.classList.add('is-error');
        } else if (currentEditorErrorMeta.contextLines.has(lineNumber)) {
          lineNumberElement.classList.add('is-context');
        }
        lineNumberElement.textContent = String(lineNumber);
        lineNumberFragment.appendChild(lineNumberElement);

        const highlightLine = document.createElement('span');
        highlightLine.className = 'db-highlight-line';
        if (currentEditorErrorMeta.errorLines.has(lineNumber)) {
          highlightLine.classList.add('is-error');
        } else if (currentEditorErrorMeta.contextLines.has(lineNumber)) {
          highlightLine.classList.add('is-context');
        }
        highlightLine.textContent = lineText || ' ';
        highlightFragment.appendChild(highlightLine);
      });

      elements.lineNumbers.innerHTML = '';
      elements.lineNumbers.appendChild(lineNumberFragment);
      elements.schemaHighlights.innerHTML = '';
      elements.schemaHighlights.appendChild(highlightFragment);
      syncSchemaEditorScroll();
    }

    function applyZoom(zoom) {
      currentZoom = Math.max(0.2, Math.min(2, zoom));
      updateZoomDisplay();

      const viewport = getViewport();
      if (!viewport || !currentSvg) {
        return;
      }

      const svgWidth = Number(currentSvg.getAttribute('width')) || 0;
      const svgHeight = Number(currentSvg.getAttribute('height')) || 0;
      viewport.style.width = `${svgWidth * currentZoom}px`;
      viewport.style.height = `${svgHeight * currentZoom}px`;
      currentSvg.style.transform = `scale(${currentZoom})`;
      currentSvg.style.transformOrigin = 'top left';
    }

    function zoomAroundPoint(zoom, clientX, clientY) {
      if (!currentSvg) {
        applyZoom(zoom);
        return;
      }

      const rect = elements.stage.getBoundingClientRect();
      const localX = clientX - rect.left + elements.stage.scrollLeft;
      const localY = clientY - rect.top + elements.stage.scrollTop;
      const contentX = localX / currentZoom;
      const contentY = localY / currentZoom;

      applyZoom(zoom);

      elements.stage.scrollLeft = contentX * currentZoom - (clientX - rect.left);
      elements.stage.scrollTop = contentY * currentZoom - (clientY - rect.top);
    }

    function fitDiagramToViewport() {
      if (!currentSvg) {
        return;
      }

      const svgWidth = Number(currentSvg.getAttribute('width')) || 1;
      const svgHeight = Number(currentSvg.getAttribute('height')) || 1;
      const availableWidth = Math.max(1, elements.stage.clientWidth - 12);
      const availableHeight = Math.max(1, elements.stage.clientHeight - 12);
      const fitZoom = Math.min(availableWidth / svgWidth, availableHeight / svgHeight, 1);
      applyZoom(fitZoom);
      elements.stage.scrollLeft = 0;
      elements.stage.scrollTop = 0;
    }

    function setSchemaCollapsed(isCollapsed) {
      elements.schemaBody.hidden = isCollapsed;
      elements.collapsedBar.hidden = !isCollapsed;
    }

    function endPan() {
      if (dragState) {
        return;
      }
      panState = null;
      elements.stage.classList.remove('is-panning');
    }

    function beginPan(event) {
      if (!currentSvg || dragState || event.button !== 0) {
        return;
      }

      panState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: elements.stage.scrollLeft,
        scrollTop: elements.stage.scrollTop
      };

      elements.stage.classList.add('is-panning');
      elements.stage.setPointerCapture(event.pointerId);
      event.preventDefault();
    }

    function movePan(event) {
      if (!panState || event.pointerId !== panState.pointerId) {
        return;
      }

      const deltaX = event.clientX - panState.startX;
      const deltaY = event.clientY - panState.startY;

      elements.stage.scrollLeft = panState.scrollLeft - deltaX;
      elements.stage.scrollTop = panState.scrollTop - deltaY;
      event.preventDefault();
    }

    function resetToBlankState(statusMessage) {
      elements.tableCount.textContent = '0';
      elements.relationshipCount.textContent = '0';
      elements.status.textContent = statusMessage;
      elements.selectionState.textContent = 'Select a table to highlight related tables and lines.';
      elements.tableSearchInput.value = '';
      elements.tableSearchOptions.innerHTML = '';
      renderSchemaEditorDecorations([]);
      currentSvg = null;
      currentParsed = null;
      currentLayout = null;
      currentConnections = [];
      currentTableGroups = new Map();
      currentManualPositions = {};
      currentRenderStateByName = new Map();
      currentExpandedTables = {};
      currentSelectedTableName = null;
      currentBackgroundRect = null;
      updateErrorPanel([], elements);
      mountDiagram(elements.stage, null, elements.emptyState);
    }

    function ensureCanvasFitsEditableState() {
      if (!currentSvg || !currentLayout || !currentBackgroundRect) {
        return;
      }

      const layoutBounds = measureLayoutBounds(currentLayout.positions);
      const svgWidth = Math.max(layoutBounds.width, currentMinimumCanvasWidth);
      const svgHeight = layoutBounds.height;

      currentSvg.setAttribute('width', String(svgWidth));
      currentSvg.setAttribute('height', String(svgHeight));
      currentSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
      currentBackgroundRect.setAttribute('width', String(svgWidth));
      currentBackgroundRect.setAttribute('height', String(svgHeight));
      applyZoom(currentZoom);
    }

    function updateConnectedRelationships(tableName) {
      currentConnections.forEach((connection) => {
        if (connection.fromTable === tableName || connection.toTable === tableName) {
          updateRelationshipPath(connection, currentLayout, currentMetrics, currentRenderStateByName);
        }
      });
      ensureCanvasFitsEditableState();
    }

    function endTableDrag() {
      if (!dragState) {
        return;
      }

      suppressSelectionClick = Boolean(dragState.didMove);
      dragState.group.classList.remove('is-dragging');
      dragState = null;
    }

    function moveTableDrag(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      const deltaX = (event.clientX - dragState.startX) / currentZoom;
      const deltaY = (event.clientY - dragState.startY) / currentZoom;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        dragState.didMove = true;
      }
      const nextX = Math.max(24, dragState.originX + deltaX);
      const nextY = Math.max(32, dragState.originY + deltaY);

      currentManualPositions[dragState.tableName] = {
        x: nextX,
        y: nextY
      };
      currentLayout.positions[dragState.tableName].x = nextX;
      currentLayout.positions[dragState.tableName].y = nextY;
      dragState.group.setAttribute('transform', `translate(${nextX}, ${nextY})`);
      updateConnectedRelationships(dragState.tableName);
      event.preventDefault();
      event.stopPropagation();
    }

    function beginTableDrag(tableName, group, event) {
      if (!currentLayout || event.button !== 0) {
        return;
      }

      const frame = currentLayout.positions[tableName];
      if (!frame) {
        return;
      }

      dragState = {
        tableName,
        group,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: frame.x,
        originY: frame.y,
        didMove: false
      };
      group.classList.add('is-dragging');
      event.preventDefault();
      event.stopPropagation();
    }

    function updateSearchOptions(tables) {
      elements.tableSearchOptions.innerHTML = '';
      tables.forEach((table) => {
        const option = document.createElement('option');
        option.value = table.name;
        elements.tableSearchOptions.appendChild(option);
      });
    }

    function centerTableInView(tableName) {
      if (!currentLayout || !currentLayout.positions[tableName]) {
        return;
      }

      const frame = currentLayout.positions[tableName];
      const targetLeft = Math.max(0, (frame.x + frame.width / 2) * currentZoom - elements.stage.clientWidth / 2);
      const targetTop = Math.max(0, (frame.y + frame.height / 2) * currentZoom - elements.stage.clientHeight / 2);

      elements.stage.scrollTo({
        left: targetLeft,
        top: targetTop,
        behavior: 'smooth'
      });
    }

    function applySelectionStyles() {
      if (!currentSelectedTableName || !currentTableGroups.has(currentSelectedTableName)) {
        currentSelectedTableName = null;
        currentTableGroups.forEach((group) => {
          group.classList.remove('is-selected', 'is-related', 'is-dimmed');
        });
        currentConnections.forEach((connection) => {
          connection.group.classList.remove('is-highlighted', 'is-dimmed');
        });
        elements.selectionState.textContent = 'Select a table to highlight related tables and lines.';
        return;
      }

      const connectedTables = new Set([currentSelectedTableName]);
      let relationshipCount = 0;

      currentConnections.forEach((connection) => {
        const isConnected = connection.fromTable === currentSelectedTableName || connection.toTable === currentSelectedTableName;
        connection.group.classList.toggle('is-highlighted', isConnected);
        connection.group.classList.toggle('is-dimmed', !isConnected);

        if (!isConnected) {
          return;
        }

        relationshipCount += 1;
        connectedTables.add(connection.fromTable);
        connectedTables.add(connection.toTable);
      });

      currentTableGroups.forEach((group, tableName) => {
        const isSelected = tableName === currentSelectedTableName;
        const isRelated = !isSelected && connectedTables.has(tableName);
        group.classList.toggle('is-selected', isSelected);
        group.classList.toggle('is-related', isRelated);
        group.classList.toggle('is-dimmed', !isSelected && !isRelated);
      });

      const connectedTableCount = Math.max(0, connectedTables.size - 1);
      elements.selectionState.textContent = `${currentSelectedTableName} selected. ${connectedTableCount} connected table${connectedTableCount === 1 ? '' : 's'} and ${relationshipCount} relationship${relationshipCount === 1 ? '' : 's'} highlighted.`;
    }

    function selectTable(tableName, shouldCenter) {
      if (!tableName || !currentTableGroups.has(tableName)) {
        return false;
      }

      currentSelectedTableName = tableName;
      elements.tableSearchInput.value = tableName;
      applySelectionStyles();
      if (shouldCenter) {
        centerTableInView(tableName);
      }
      return true;
    }

    function clearSelection() {
      currentSelectedTableName = null;
      elements.tableSearchInput.value = '';
      applySelectionStyles();
    }

    function resolveTableSearch(query) {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery || !currentParsed) {
        return null;
      }

      const exactMatch = currentParsed.tables.find((table) => table.name.toLowerCase() === normalizedQuery);
      if (exactMatch) {
        return exactMatch.name;
      }

      const partialMatch = currentParsed.tables.find((table) => table.name.toLowerCase().includes(normalizedQuery));
      return partialMatch ? partialMatch.name : null;
    }

    function jumpToSearchResult() {
      const tableName = resolveTableSearch(elements.tableSearchInput.value);
      if (!tableName) {
        elements.status.textContent = 'No matching table found.';
        return;
      }

      selectTable(tableName, true);
      elements.status.textContent = `Jumped to ${tableName}.`;
    }

    function bindTableDragging() {
      if (!currentSvg) {
        return;
      }

      currentTableGroups.forEach((group, tableName) => {
        group.addEventListener('pointerdown', (event) => {
          if (event.target && typeof event.target.closest === 'function' && event.target.closest('[data-table-toggle="true"]')) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }

          beginTableDrag(tableName, group, event);
        });
        group.addEventListener('click', (event) => {
          if (event.target && typeof event.target.closest === 'function' && event.target.closest('[data-table-toggle="true"]')) {
            currentExpandedTables[tableName] = !currentExpandedTables[tableName];
            renderParsedDiagram(currentParsed, true);
            event.preventDefault();
            event.stopPropagation();
            return;
          }

          if (suppressSelectionClick) {
            suppressSelectionClick = false;
            event.preventDefault();
            event.stopPropagation();
            return;
          }

          selectTable(tableName, false);
          event.preventDefault();
          event.stopPropagation();
        });
      });

      currentSvg.addEventListener('pointermove', moveTableDrag);
      currentSvg.addEventListener('pointerup', endTableDrag);
      currentSvg.addEventListener('pointercancel', endTableDrag);
    }

    function pruneManualPositions(tables) {
      const validNames = new Set(tables.map((table) => table.name));
      currentManualPositions = Object.fromEntries(
        Object.entries(currentManualPositions).filter(([tableName]) => validNames.has(tableName))
      );
      currentExpandedTables = Object.fromEntries(
        Object.entries(currentExpandedTables).filter(([tableName]) => validNames.has(tableName))
      );
      if (currentSelectedTableName && !validNames.has(currentSelectedTableName)) {
        currentSelectedTableName = null;
      }
    }

    function renderParsedDiagram(parsed, preserveScrollPosition) {
      const previousScrollLeft = preserveScrollPosition ? elements.stage.scrollLeft : 0;
      const previousScrollTop = preserveScrollPosition ? elements.stage.scrollTop : 0;
      try {
        const stageWidth = Math.max(0, elements.stage.clientWidth - CANVAS_SIDE_PADDING * 2);
        const rendered = renderDiagram(parsed, stageWidth, currentManualPositions, currentFontScale, currentExpandedTables);
        currentSvg = rendered.svg;
        currentLayout = rendered.layout;
        currentConnections = rendered.connections;
        currentTableGroups = rendered.tableGroups;
        currentRenderStateByName = rendered.renderStateByName;
        currentMetrics = rendered.metrics;
        currentBackgroundRect = rendered.backgroundRect;
        currentMinimumCanvasWidth = rendered.minimumCanvasWidth;
        mountDiagram(elements.stage, currentSvg, elements.emptyState);
        if (preserveScrollPosition) {
          applyZoom(currentZoom);
        } else {
          fitDiagramToViewport();
        }
        bindTableDragging();
        applySelectionStyles();
        if (preserveScrollPosition) {
          elements.stage.scrollLeft = previousScrollLeft;
          elements.stage.scrollTop = previousScrollTop;
        }
        elements.status.textContent = `Rendered ${parsed.tables.length} table${parsed.tables.length === 1 ? '' : 's'} and ${parsed.relationships.length} relationship${parsed.relationships.length === 1 ? '' : 's'}.`;
      } catch (error) {
        currentSvg = null;
        mountDiagram(elements.stage, null, elements.emptyState);
        elements.status.textContent = error.message;
      }
    }

    function refreshDiagram(preserveScrollPosition) {
      const parsed = parseDbmlSchema(elements.schemaInput.value);
      currentParsed = parsed;
      pruneManualPositions(parsed.tables);
      updateSearchOptions(parsed.tables);
      elements.tableCount.textContent = String(parsed.tables.length);
      elements.relationshipCount.textContent = String(parsed.relationships.length);
      updateErrorPanel(parsed.errors, elements);
      renderSchemaEditorDecorations(parsed.errors);
      renderParsedDiagram(parsed, Boolean(preserveScrollPosition));
    }

    elements.loadSampleButton.addEventListener('click', () => {
      elements.schemaInput.value = SAMPLE_SCHEMA;
      setSchemaCollapsed(false);
      refreshDiagram();
    });

    elements.clearButton.addEventListener('click', () => {
      elements.schemaInput.value = '';
      setSchemaCollapsed(false);
      resetToBlankState('Schema cleared.');
    });

    elements.renderButton.addEventListener('click', () => {
      refreshDiagram(false);
      setSchemaCollapsed(true);
    });

    elements.zoomOutButton.addEventListener('click', () => {
      applyZoom(currentZoom - 0.1);
    });

    elements.zoomInButton.addEventListener('click', () => {
      applyZoom(currentZoom + 0.1);
    });

    elements.zoomResetButton.addEventListener('click', () => {
      applyZoom(1);
    });

    elements.zoomFitButton.addEventListener('click', () => {
      fitDiagramToViewport();
    });

    elements.tableSearchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        jumpToSearchResult();
        event.preventDefault();
      }
    });

    elements.jumpTableButton.addEventListener('click', () => {
      jumpToSearchResult();
    });

    elements.fontScaleInput.addEventListener('input', () => {
      currentFontScale = Number(elements.fontScaleInput.value) / 100;
      elements.fontScaleValue.textContent = `${elements.fontScaleInput.value}%`;
      if (currentParsed && currentSvg) {
        renderParsedDiagram(currentParsed, true);
      }
    });

    elements.schemaInput.addEventListener('input', () => {
      const liveParsed = parseDbmlSchema(elements.schemaInput.value);
      renderSchemaEditorDecorations(liveParsed.errors);
    });

    elements.schemaInput.addEventListener('scroll', syncSchemaEditorScroll);

    elements.editSchemaButton.addEventListener('click', () => {
      setSchemaCollapsed(false);
    });

    elements.editSchemaSecondaryButton.addEventListener('click', () => {
      setSchemaCollapsed(false);
    });

    elements.stage.addEventListener('pointerdown', beginPan);
    elements.stage.addEventListener('pointermove', movePan);
    elements.stage.addEventListener('pointerup', endPan);
    elements.stage.addEventListener('pointercancel', endPan);
    elements.stage.addEventListener('wheel', (event) => {
      if (!currentSvg || !(event.ctrlKey || event.metaKey)) {
        return;
      }

      const nextZoom = currentZoom + (event.deltaY < 0 ? 0.12 : -0.12);
      zoomAroundPoint(nextZoom, event.clientX, event.clientY);
      event.preventDefault();
    }, { passive: false });
    elements.stage.addEventListener('click', (event) => {
      if (!currentSvg) {
        return;
      }

      if (event.target === currentBackgroundRect || event.target === currentSvg || event.target === getViewport()) {
        clearSelection();
      }
    });
    elements.stage.addEventListener('pointerleave', (event) => {
      if (panState && !elements.stage.hasPointerCapture(event.pointerId)) {
        endPan();
      }
    });
    elements.downloadDbmlButton.addEventListener('click', () => {
      if (!elements.schemaInput.value.trim()) {
        elements.status.textContent = 'Add schema text before downloading DBML.';
        return;
      }

      downloadDbml(elements.schemaInput.value);
      elements.status.textContent = 'DBML downloaded.';
    });

    elements.downloadPngButton.addEventListener('click', async () => {
      if (!currentSvg) {
        elements.status.textContent = 'Render a diagram before downloading PNG.';
        return;
      }

      try {
        await downloadPng(currentSvg);
        elements.status.textContent = 'PNG downloaded.';
      } catch (error) {
        elements.status.textContent = error.message;
      }
    });

    elements.downloadButton.addEventListener('click', () => {
      if (!currentSvg) {
        elements.status.textContent = 'Render a diagram before downloading the SVG.';
        return;
      }

      downloadSvg(currentSvg);
      elements.status.textContent = 'SVG downloaded.';
    });

    elements.schemaInput.value = '';
    renderSchemaEditorDecorations([]);
    elements.fontScaleValue.textContent = `${elements.fontScaleInput.value}%`;
    updateZoomDisplay();
    setSchemaCollapsed(false);
    resetToBlankState('Paste a schema or load the sample to start.');

    window.onThemeToggle = () => {
      if (currentParsed && currentSvg) {
        renderParsedDiagram(currentParsed, true);
      }
    };

    window.addEventListener('resize', () => {
      if (!currentParsed || !currentSvg) {
        return;
      }

      if (resizeFrame) {
        cancelAnimationFrame(resizeFrame);
      }

      resizeFrame = requestAnimationFrame(() => {
        renderParsedDiagram(currentParsed, true);
      });
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initializePage);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseDbmlSchema
    };
  }
})();
