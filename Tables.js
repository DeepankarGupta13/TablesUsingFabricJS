
import { fabric } from 'fabric'
import { TABLE_COLUMN_WIDTH_SCALE, TABLE_ROW_HEIGHT_SCALE } from '../constants/constants';


export default class PermitTable {
    constructor(canvas, position, noOfColumns, noOfRows, columnWidth, rowHeight, cells) {
        this.canvas = canvas;

        this.position = position;
        this.noOfColumns = noOfColumns;
        this.noOfRows = noOfRows;
        this.columnWidth = columnWidth;
        this.rowHeight = rowHeight;
        this.cells = cells;
        this.createTable();
    }

    saveObject() {
        const cellData = []
        this.cells.forEach((cell) => {
            cellData.push(cell.saveObject())
        });
    
        const saveData = {
            position: this.position,
            noOfColumns: this.noOfColumns,
            noOfRows: this.noOfRows,
            columnWidth: this.columnWidth,
            rowHeight: this.rowHeight,
            cellData: cellData,
        }

        return saveData;
    }

    loadObject(loadData) {
        this.position = loadData.position;
        this.noOfColumns = loadData.noOfColumns;
        this.noOfRows = loadData.noOfRows;
        this.columnWidth = loadData.columnWidth;
        this.rowHeight = loadData.rowHeight;

        const cells = [];

        loadData.cellData.forEach((cellData) => {
            const cell = new Cell();
            cell.loadObject(cellData);

            cells.push(cell);
        })

        this.cells = cells;

        this.createTable();
    }

    createTable() {
        this.totalColumnWidth = (this.columnWidth.reduce((partialSum, a) => partialSum + a, 0));
        this.totalRowHeight = this.rowHeight.reduce((partialSum, a) => partialSum + a, 0);
        this.rows = this.getRows();
        this.columns = this.getColumns();
        this.updateCellsMergeNo();
        this.lines = []
        this.texts = []
        this.createRows(this.lines);
        this.createColumns(this.lines);
        this.addTextBoxes(this.texts);
        this.editing = false;

        this.group = new fabric.Group([...this.lines, ...this.texts])

        this.onAllTextEventListener();
        this.onAllLineEventListener();
        this.onCanvasEventListeners();
        this.onGroupEventListeners();

        this.canvas.add(this.group)
    }

    updateCellsMergeNo() {
        const allRows = this.getRows();

        this.cells.forEach((ele) => {
            ele.noOfVerticalMergedCells = 0;
            ele.noOfHorizontalMergedCells = 0;
        })

        for (let i = 0; i < allRows.length; i++) {
            let j = 0;
            let mainCell = null;
            for (j = 0; j < allRows[i].length; j+=1) {
                if (!(allRows[i][j].cellMergedFlag)) {
                    mainCell = allRows[i][j];
                    while (j < allRows[i].length -1 && allRows[i][j+1].cellMergedFlag) {
                        mainCell.noOfHorizontalMergedCells += 1;
                        if ( j < (allRows[i].length - allRows[i].indexOf(mainCell) - 1)) j++;
                        else break
                    }
                }
            }
        }

        const allColumns = this.getColumns();
        for (let i = 0; i < allColumns.length; i++) {
            let j = 0;
            let mainCell = null;
            for (j = 0; j < allColumns[i].length; j+=1) {
                if (!(allColumns[i][j].cellVerticalMergedFlag)) {
                    mainCell = allColumns[i][j];
                    while (j < allColumns[i].length -1 && allColumns[i][j+1].cellVerticalMergedFlag) {
                        mainCell.noOfVerticalMergedCells += 1;
                        if ( j < (allColumns[i].length - allColumns[i].indexOf(mainCell) - 1)) j++;
                        else break
                    }
                }
            }
        }

    }

    onGroupEventListeners() {
        this.group.on('mousedown', this.fabricDblClick(this.group, (obj) => {
            this.ungroup(this.group);
            this.onAllTextEventListener();
            this.canvas.renderAll();
        }))
    }

    onCanvasEventListeners() {
        this.canvas.on('mouse:down', (obj) => {
            if (this.editing) {
                if (obj.target === null) {
                    this.editing = false;
                    this.groupAgain();
                }
                else {
                    if((!this.texts.includes(obj.target)) && (obj.target.get('type') === 'textbox')) {
                        this.editing = false;
                        this.groupAgain();
                    }
                }
            }
        })

        this.canvas.on('text:changed', (opt) => {
            let t1 = opt.target;
            t1.cell.cellText = t1.text;
            console.log('t1: ', t1);
            if ((t1.get('type') === 'textbox') && (t1.parent instanceof PermitTable)) {
                if (t1.width > t1.fixedWidth) {
                    t1.width = t1.fixedWidth;
                    this.rearrangeTextLines(t1);
                }
            }
        });
    }

    onAllTextEventListener() {
        this.editing = false;
        let isShiftPressed = false;

        // Check if the Shift key is pressed
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Shift') {
                isShiftPressed = true;
            }
        });

        // Check if the Shift key is released
        document.addEventListener('keyup', function (event) {
            if (event.key === 'Shift') {
                isShiftPressed = false;
            }
        });

        for (let i = 0; i < this.texts.length; i++) {
            this.texts[i].on('mousedown', (obj) => {
                this.editing = true;
                if (!isShiftPressed) {
                    this.canvas.setActiveObject(this.texts[i]);
                    this.texts[i].enterEditing();
                    this.texts[i].setSelectionStart(this.texts[i].text.length);
                    this.texts[i].setSelectionEnd(this.texts[i].text.length);
                }
            })
        }
    }

    onAllLineEventListener() {
        let startPosition = null;
        let delta = null;

        console.log('this.lines: ', this.lines);
        for (let j = 0; j < this.lines.length; j++) {
            this.lines[j].on('mousedown', (obj) => {
                startPosition = obj.target.getCenterPoint();
            });

            this.lines[j].on('mouseup', (obj) => {
                delta = obj.target.getCenterPoint().subtract(startPosition);
                if (obj.target.tableLineType === 'row') {
                    const rowNo = obj.target.rowNo;
                    let change = delta.y / TABLE_ROW_HEIGHT_SCALE;
                    if ( change < -0.2) {
                        change = 0
                    }
                    if (rowNo !== 0) {
                        this.rowHeight[rowNo - 1] += change;
                    }
                    else {
                        this.rowHeight[rowNo] -= change;
                    }
                }
                else {
                    const columnNo = obj.target.columnNo;
                    console.log('columnNo: ', columnNo);
                    let change = delta.x / TABLE_ROW_HEIGHT_SCALE;
                    console.log('change: ', change);
                    if (columnNo === 0) {
                        this.columnWidth[columnNo] -= change;
                        // this.position.x -= change * TABLE_ROW_HEIGHT_SCALE;
                    }
                    else if (columnNo === this.columnWidth.length) {
                        this.columnWidth[columnNo - 1] += change;
                    }
                    else {
                        this.columnWidth[columnNo] -= change;
                        this.columnWidth[columnNo - 1] += change;
                    }
                }

                // update table
                this.removeTable();
                this.updateTable();
                this.onCanvasEventListeners();
                this.onGroupEventListeners();
            })
        }
    }
    // merge cells
    mergeCells() {
        const cells = this.getSelectedCells();
        const mainCell = cells[0][0].cell;

        // merge
        for (let i = 0; i < cells.length; i++) {
            for (let j = 0; j < cells[i].length; j++) {
                if (cells[i][j].cell === mainCell) continue;
                if (j !== 0) {
                    cells[i][j].cell.cellMergedFlag = true;
                    cells[i][j].cell.cellText = "";
                }
                if (i === 0) continue;
                else {
                    cells[i][j].cell.cellVerticalMergedFlag = true;
                    cells[i][j].cell.cellText = "";
                }
                // this.cells.splice(this.cells.indexOf(cells[i][j]), 1);
            }
        }

        this.removeTable();
        this.updateTable();
        this.updateCellsMergeNo();
        this.onCanvasEventListeners();
        this.onGroupEventListeners();
    }

    // merge cell
    demergeCells() {
        const cells = this.getSelectedCells(true);

        const mainCell = cells[0][0];

        if (mainCell.cell.noOfHorizontalMergedCells) {
            const allRows = this.getRows();
            for (let i = mainCell.pos.column; i <= mainCell.pos.column + mainCell.cell.noOfHorizontalMergedCells; i++) {
                this.cells[this.cells.indexOf(allRows[mainCell.pos.row][i])].cellMergedFlag = false;
            }
        }


        const allRows = this.getRows();
        for (let i = mainCell.pos.column; i <= mainCell.pos.column + mainCell.cell.noOfHorizontalMergedCells; i++) {
            const mainRowCell = {
                cell: allRows[mainCell.pos.row][i],
                pos: { row: mainCell.pos.row, column: i },
            }
            if (mainRowCell.cell.noOfVerticalMergedCells) {
                for (let j = mainRowCell.pos.row; j <= mainRowCell.pos.row + mainRowCell.cell.noOfVerticalMergedCells; j++) {
                    this.cells[this.cells.indexOf(allRows[j][mainRowCell.pos.column])].cellVerticalMergedFlag = false;
                    this.cells[this.cells.indexOf(allRows[j][mainRowCell.pos.column])].cellMergedFlag = false;
                }
            }
        }

        this.removeTable();
        this.updateTable();
        this.updateCellsMergeNo();
        this.onCanvasEventListeners();
        this.onGroupEventListeners();
    }

    // add row above or below
    addRow(above = false) {
        // get selected cells andits row no
        let cell = [];
        if (above) {
            cell = this.getFirstSelectedCell();
        }
        else {
            cell = this.getSelectedCells();
        }
        let rowNo = cell[0][0].pos.row;

        // current rows
        const allRows = this.getRows();

        // add new cells to this.cells

        // the position where we will add our new row height
        let rowHeightPosition = 0;

        // row below which we will add our new row
        let aboveRow = null;
        let belowRow = null;

        // if add above is false then we make above row below which we will add our new row as the current row
        if (!above) {
            aboveRow = allRows[rowNo];
            belowRow = allRows[rowNo + 1]
            rowHeightPosition = rowNo + 1;
        }
        // else we take above row as the the row below the current row
        else {
            aboveRow = allRows[rowNo - 1];
            belowRow = allRows[rowNo]
            rowHeightPosition = rowNo;
        }

        // new cells are the cells to be added
        const newCells = [];
        for (let i = 0; i < this.noOfColumns; i++) {
            const newCell = new Cell('')
            if (belowRow) {
                newCell.cellMergedFlag = belowRow[i].cellMergedFlag;
                newCell.cellVerticalMergedFlag = belowRow[i].cellVerticalMergedFlag;
            }
            newCells.push(newCell);
        }
        // if there is above row present then add below that row
        if (aboveRow) {
            const lastCell = aboveRow[aboveRow.length - 1]

            // pushing new cells to the cells array
            this.cells.splice(this.cells.indexOf(lastCell)+1, 0, ...newCells)
        }
        // else just push the new rows at the start of the cells
        else {
            this.cells.unshift(...newCells);
        }

        // increase noOfRows
        this.noOfRows += 1;

        // add row height of the new added row
        this.rowHeight.splice(rowHeightPosition, 0, 0.3);

        // update rows and columns value
        this.columns = this.getColumns();
        this.rows = this.getRows();

        // update table
        this.removeTable();
        this.updateTable();
        this.onCanvasEventListeners();
        this.onGroupEventListeners();
    }

    // delete row
    deleteRow() {
        // get selected cells andits row no
        const cell = this.getSelectedCells();
        const rowNo = cell[0].pos.row;

        // remove cells of selected cell's row
        const allRows = this.getRows();
        const removeCells = allRows[rowNo];
        removeCells.forEach(cell => {
            const index = this.cells.indexOf(cell);
            // while removing cell should check if is merged or not with below cell
            // if merged then transfer the properties to the next cell
            if (index - 1 < 0) {
                if (this.cells[index - 1].cellVerticalMergedFlag) {
                    this.cells[index - 1] = this.cells[index]
                }
            }
            this.cells.splice(index, 1);
        })

        // remove rowHeight from rowHeights
        this.rowHeight.splice(rowNo, 1);

        // decrease noOfRows
        this.noOfRows -= 1;

        // update rows and columns value
        this.columns = this.getColumns();
        this.rows = this.getRows();

        // update table
        this.removeTable();
        this.updateTable();
        this.onCanvasEventListeners();
        this.onGroupEventListeners();
    }

    // add column
    addColumn(left = false) {
        // get selected cells andits row no
        let cell = [];
        if (left) {
            cell = this.getFirstSelectedCell();
        }
        else {
            cell = this.getSelectedCells();
        }
        let colNo = cell[0][0].pos.column;

        // current columns
        const allColumns = this.getColumns();

        // add new cells to this.cells

        // the position where we will add our new column width
        let columnWidthPosition = 0;

        // row below which we will add our new row
        let leftColumn = null;
        let rightColumn = null;

        // if add above is false then we make above row below which we will add our new row as the current row
        if (!left) {
            leftColumn = allColumns[colNo];
            rightColumn = allColumns[colNo + 1];
            columnWidthPosition = colNo + 1;
        }
        // else we take above row as the the row below the current row
        else {
            leftColumn = allColumns[colNo - 1];
            rightColumn = allColumns[colNo];
            columnWidthPosition = colNo;
        }
        // new cells are the cells to be added
        const newCells = [];
        for (let i = 0; i < this.noOfRows; i++) {
            const newCell = new Cell('')
            if (rightColumn) {
                newCell.cellMergedFlag = rightColumn[i].cellMergedFlag;
                newCell.cellVerticalMergedFlag = rightColumn[i].cellVerticalMergedFlag;
            }
            newCells.push(newCell);
        }

        const length = leftColumn ? leftColumn.length : rightColumn.length;
        // pushing new cells to this.cells at proper position
        for (let i = 0; i < length; i++) {
            if (leftColumn) {
                const index = this.cells.indexOf(leftColumn[i]);
                this.cells.splice(index + 1, 0, newCells[i]);
            }
            else {
                const index = this.cells.indexOf(rightColumn[i]);
                this.cells.splice(index, 0, newCells[i]);
            }
        }


         // increase noOfRows
         this.noOfColumns += 1;

         // add row height of the new added row
         this.columnWidth.splice(columnWidthPosition, 0, 0.3);
 
         // update rows and columns value
         this.columns = this.getColumns();
         this.rows = this.getRows();
 
         // update table
         this.removeTable();
         this.updateTable();
         this.onCanvasEventListeners();
         this.onGroupEventListeners();
    }

    // delete column
    deleteColumn() {
        // get selected cells andits row no
        const cell = this.getSelectedCells();
        const colNo = cell[0].pos.column;

        // remove cells of selected cell's column
        const allCols = this.getColumns();
        const removeCells = allCols[colNo];
        removeCells.forEach(cell => {
            const index = this.cells.indexOf(cell);
            // while removing cell should check if is merged or not with next cell
            // if merged then transfer the properties to the next cell
            if (index + 1 < this.cells.length) {
                if (this.cells[index + 1].cellMergedFlag) {
                    this.cells[index + 1] = this.cells[index]
                }
            }
            this.cells.splice(index, 1);
        })

        // remove columnWidth from columnWidths
        this.columnWidth.splice(colNo, 1);

        // decrease noOfColumns
        this.noOfColumns -= 1;

        // update rows and columns
        this.columns = this.getColumns();
        this.rows = this.getRows();

        this.removeTable();
        this.updateTable();
        this.onCanvasEventListeners();
        this.onGroupEventListeners();
    }

    fabricDblClick(obj, handler) {
        return function () {
            if (obj.clicked) handler(obj);
            else {
                obj.clicked = true;
                setTimeout(function () {
                    obj.clicked = false;
                }, 500);
            }
        };
    };

    ungroup(group) {
        var items;
        items = group._objects;
        group._restoreObjectsState();
        this.canvas.remove(group);
        this.canvas.renderAll();
        for (var i = 0; i < items.length; i++) {
            this.canvas.add(items[i]);
        }
        // if you have disabled render on addition
        this.canvas.renderAll();
    };

    rearrangeTextLines(t1) {
        const textLines = [];
        let i = 0;
        while (i < t1.text.length) {
            const line = [];
            let lineWidth = 0;
            let j = 0;
            while (lineWidth < t1.fixedWidth) {
                lineWidth += this.getCharWidth(t1.text[i], t1.fontSize);
                if (t1.text[i]) {
                    line.push(t1.text[i]);
                    i++;
                }
            }
            textLines.push(line);
        }
        t1.text = '';
        for (let i = 0; i < textLines.length; i++) {
            let nextLine = '';
            if (textLines[i][0] !== '\n') {
                nextLine = i === 0 ? '' : '\n';
            }
            t1.text += nextLine + textLines[i].join('');
            t1.setSelectionStart(t1.text.length);
            t1.setSelectionEnd(t1.text.length);
        }
        const textboxHeight = t1.height * textLines.length;
        if (textboxHeight > (this.rowHeight[t1.tablePos.row] * TABLE_ROW_HEIGHT_SCALE)) {
            // update the table
            t1.cell.cellText = t1.text;
            this.rowHeight[t1.tablePos.row] += ((t1.fontSize + 5)/TABLE_ROW_HEIGHT_SCALE);
            this.removeTable();
            this.editing = false;
            this.updateTable();
            this.ungroup(this.group);
            let newT1 = null
            for (let i = 0; i < this.texts.length; i++) {
                if (this.texts[i].tablePos.row === t1.tablePos.row && this.texts[i].tablePos.column === t1.tablePos.column) {
                    newT1 = this.texts[i];
                    break;
                }
            }
            if (newT1) {
                this.canvas.setActiveObject(newT1);
                newT1.enterEditing();
                newT1.setSelectionStart(newT1.text.length);
                newT1.setSelectionEnd(newT1.text.length);
            }
        }
        else {
            t1.height += t1.fontSize;
        }
    }

    groupAgain() {
        this.canvas.remove(...this.group._objects);
        this.group.remove(...this.group._objects);
        this.group = new fabric.Group([...this.lines, ...this.texts])
        this.canvas.add(this.group);
        this.group.on('mousedown', this.fabricDblClick(this.group, (obj) => {
            this.ungroup(this.group);
        }));
    }

    removeTable() {
        this.canvas.remove(...this.group._objects);
        this.group.remove(...this.group._objects);
        this.lines = [];
        this.texts = [];
        this.canvas.discardActiveObject();
    }

    getCharWidth(char, fontSize) {
        var text = document.createElement("span");
        document.body.appendChild(text);

        text.style.font = "times new roman";
        text.style.fontSize = fontSize + "px";
        text.style.height = 'auto';
        text.style.width = 'auto';
        text.style.position = 'absolute';
        text.style.whiteSpace = 'no-wrap';
        text.innerHTML = char;

        const width = Math.ceil(text.clientWidth);
        document.body.removeChild(text);
        return width;
    }

    createRows(lines) {
        const xRowOffset = this.totalColumnWidth * TABLE_COLUMN_WIDTH_SCALE;
        const rowLines = [];
        let yRowOffset = 0;
        // row lines
        for (let i = 0; i < this.noOfRows; i++) {
            const rowXCoordinate = [];
            yRowOffset = yRowOffset + (i > 0 ? this.rowHeight[i - 1] : 0);
            const y = (this.position.y) + (yRowOffset * TABLE_ROW_HEIGHT_SCALE);
            let x = this.position.x;
            for (let j = 0 ; j < this.noOfColumns; j++) {
                if (this.rows[i][j].cellVerticalMergedFlag) {
                    x = x + (this.columnWidth[j] * TABLE_ROW_HEIGHT_SCALE);
                    continue;
                }
                else {
                    const x1 = x;
                    const x2 = x1 + (this.columnWidth[j] * TABLE_ROW_HEIGHT_SCALE);
                    if (rowXCoordinate.length > 0) {
                        if (x1 !== rowXCoordinate[rowXCoordinate.length - 1][1]) rowXCoordinate.push([x1, x2]);
                        else rowXCoordinate[rowXCoordinate.length - 1][1] = x2
                    }
                    else {
                        rowXCoordinate.push([x1, x2]);
                    }
                    x = x2;
                }
            }
            for (let k = 0; k < rowXCoordinate.length; k++) {
                const points =  [{
                    x: rowXCoordinate[k][0],
                    y: y,
                },
                {
                    x: rowXCoordinate[k][1],
                    y: y,
                }]
                rowLines.push({
                    rowNo: i,
                    points,
                })
            }
        }
        const points = [
            {
                x: this.position.x,
                y: this.position.y + (this.totalRowHeight * TABLE_ROW_HEIGHT_SCALE),
            },
            {
                x: this.position.x + (this.totalColumnWidth * TABLE_COLUMN_WIDTH_SCALE),
                y: this.position.y + (this.totalRowHeight * TABLE_ROW_HEIGHT_SCALE),
            }
        ]
        rowLines.push({
            rowNo: this.noOfRows,
            points,
        });

        for (let i = 0; i < rowLines.length ; i++) {
            const point = [
                rowLines[i].points[0].x,
                rowLines[i].points[0].y,
                rowLines[i].points[1].x,
                rowLines[i].points[1].y,
            ]
            const line = new fabric.Line(point,  {
                stroke: 'black',
                lockMovementX: true,
                lockScalingX: true,
                lockScalingY: true,
                tableLineType: 'row',
                rowNo: rowLines[i].rowNo,
            });
            lines.push(line);
        }
    }

    createColumns(lines) {
        // column lines
        const columnLines = [];
        let xColumnOffset = 0;
        for (let j = 0; j < this.noOfColumns; j++) {
            const columnYCoordinates = [];
            xColumnOffset = xColumnOffset + (j > 0 ? this.columnWidth[j - 1] : 0);
            const x = this.position.x + (xColumnOffset * TABLE_COLUMN_WIDTH_SCALE);
            let y = this.position.y;
            for (let i = 0; i < this.noOfRows; i++) {
                if (this.columns[j][i].cellMergedFlag) {
                    y = y + (this.rowHeight[i] * TABLE_ROW_HEIGHT_SCALE);
                    continue;
                }
                else {
                    const y1 = y;
                    const y2 = y1 + (this.rowHeight[i] * TABLE_ROW_HEIGHT_SCALE);
                    if (columnYCoordinates.length > 0) {
                        if (y1 !== columnYCoordinates[columnYCoordinates.length - 1][1]) columnYCoordinates.push([y1, y2]);
                        else columnYCoordinates[columnYCoordinates.length - 1][1] = y2
                    }
                    else {
                        columnYCoordinates.push([y1, y2]);
                    }
                    y = y2;
                }
            }
            for (let i= 0; i < columnYCoordinates.length; i++) {
                const points = [
                    {
                        x: x,
                        y: columnYCoordinates[i][0],
                    },
                    {
                        x: x,
                        y: columnYCoordinates[i][1],
                    }
                ]
                columnLines.push({
                    columnNo: j,
                    points,
                })
            }
        }
        const points = [
            {
                x: this.position.x +(this.totalColumnWidth * TABLE_COLUMN_WIDTH_SCALE),
                y: this.position.y,
            },
            {
                x: this.position.x + (this.totalColumnWidth * TABLE_COLUMN_WIDTH_SCALE),
                y: this.position.y + (this.totalRowHeight * TABLE_ROW_HEIGHT_SCALE),
            }
        ]
        columnLines.push({
            columnNo: this.addColumn.noOfColumns,
            points,
        })

        for (let i = 0; i < columnLines.length ; i++) {
            const point = [
                columnLines[i].points[0].x,
                columnLines[i].points[0].y,
                columnLines[i].points[1].x,
                columnLines[i].points[1].y,
            ]
            const line = new fabric.Line(point,  {
                stroke: 'black',
                lockMovementY: true,
                lockScalingX: true,
                lockScalingY: true,
                tableLineType: 'column',
                columnNo: columnLines[i].columnNo,
            });
            lines.push(line)
        }
    }

    addTextBoxes(texts) {
        const text = [];
        let yRowOffset = 0
        for (let i = 0; i < this.noOfRows; i++) {
            yRowOffset = yRowOffset + (i > 0 ? this.rowHeight[i - 1] : 0);
            const y = (this.position.y) + (yRowOffset * TABLE_ROW_HEIGHT_SCALE);
            let x = this.position.x;
            const xs = [];
            const cell = [];
            for (let j = 0; j < this.noOfColumns; j++) {
                if (this.rows[i][j].cellMergedFlag) {
                    x = x + (this.columnWidth[j] * TABLE_COLUMN_WIDTH_SCALE);
                    xs[xs.length - 1][1] = x;
                    continue;
                }
                else {
                    const x1 = x;
                    const x2 = x1 + (this.columnWidth[j] * TABLE_COLUMN_WIDTH_SCALE);
                    xs.push([x1, x2]);
                    cell.push({
                        cell: this.rows[i][j],
                        row: i,
                        column: j,
                    })
                    x = x2;
                }
            }
            for (let j = 0; j < xs.length; j++) {
                text.push({
                    startPoint: {
                        x: xs[j][0],
                        y: y,
                    },
                    endPoint: {
                        x: xs[j][1],
                        y: y
                    },
                    cell: cell[j].cell,
                    row: cell[j].row,
                    column: cell[j].column,
                })
            }
        }

        const columnWiseText = [...text]

        columnWiseText.sort((a,b) => a.column - b.column)

        let i = 0;
        while (i < columnWiseText.length) {
            if (columnWiseText[i].cell.cellVerticalMergedFlag) {
                const indexModify = text.indexOf(columnWiseText[i - 1]);
                const indexDelete = (text.indexOf(columnWiseText[i]));
                text[indexModify].endPoint.y = columnWiseText[i].endPoint.y;
                columnWiseText.splice(i, 1);
                text.splice(indexDelete, 1)
            }
            else {
                i++;
            }
        }

        for (let i = 0; i < text.length; i++) {
            const mergedColumnWidth = text[i].endPoint.x - text[i].startPoint.x;
            const mergedRowHeight = text[i].endPoint.y - text[i].startPoint.y;
            const textbox = new fabric.Textbox(text[i].cell.cellText, {
                originX: 'center',
                originY: 'center',
                left: (text[i].startPoint.x + (mergedColumnWidth * 0.5)),
                top: (text[i].startPoint.y + (this.rowHeight[text[i].row] * TABLE_ROW_HEIGHT_SCALE * 0.5) + (mergedRowHeight * 0.25)),
                point: { x: (text[i].startPoint.x + (mergedColumnWidth * 0.5)), y: (text[i].startPoint.y + (this.rowHeight[text[i].row] * TABLE_ROW_HEIGHT_SCALE * 0.5))},
                width: mergedColumnWidth,
                textAlign: 'center',
                fontSize: 12,
                underline: text[i].cell.cellTextUnderline,
                fontWeight: text[i].cell.cellTextWeigth,
                fontStyle: text[i].cell.cellTextStyle,
                lockMovementX: true,
                lockMovementY: true,
                lockScalingX: true,
                lockScalingY: true,
                parent: this,
                cell: text[i].cell,
                tablePos: {row: text[i].row, column: text[i].column},
                fixedWidth: mergedColumnWidth,
            })
            texts.push(textbox);
        }
    }

    getRows() {
        const rows = [];
        const cells = [...this.cells];
        while (cells.length > 0) {
            const row = [];
            for (let i = 0; i < this.noOfColumns; i++) {
                row.push(cells[0]);
                cells.shift()
            }
            rows.push(row);
        }
        return rows;
    }

    getColumns() {
        const columns = [];
        const cells = [...this.cells];
        for (let j = 0; j < this.noOfColumns; j++) {
            const column = [];
            for (let i = 0; i < this.noOfRows; i++) {
                column.push(cells[j + (i*this.noOfColumns)]);
            }
            columns.push(column);
        }
        return columns;
    }

    updateTable() {
        this.totalColumnWidth = (this.columnWidth.reduce((partialSum, a) => partialSum + a, 0));
        this.totalRowHeight = this.rowHeight.reduce((partialSum, a) => partialSum + a, 0);
        this.rows = this.getRows();
        this.lines = [];
        this.texts = [];
        this.createRows(this.lines);
        this.createColumns(this.lines);
        this.addTextBoxes(this.texts);
        const prevTablePos = {
            left: this.group.left,
            top: this.group.top,
        }

        this.group = new fabric.Group([...this.lines, ...this.texts]);
        this.group.left = prevTablePos.left;
        this.group.top = prevTablePos.top;

        this.onAllTextEventListener();
        this.onAllLineEventListener();
        this.canvas.add(this.group);
    }

    getFirstSelectedCell() {
        return [this.canvas.getActiveObjects().map((ele) => { 
            return({
                cell: ele.cell,
                pos: ele.tablePos,
            });
        })];
    }

    getSelectedCells(demerge = false) {
        const cells = [];
        const selectedCell = this.canvas.getActiveObjects().map((ele) => { 
            return({
                cell: ele.cell,
                pos: ele.tablePos,
            });
        });

        // const rowPositions = selectedCell.map(ele => ele.pos.row);
        // const colPosition = selectedCell.map(ele => ele.pos.column);

        const rowPositions = [];
        const colPosition = [];

        for (let i = 0; i < selectedCell.length; i++) {
            if (selectedCell[i].cell.noOfHorizontalMergedCells && !demerge) {
                colPosition.push(selectedCell[i].pos.column + selectedCell[i].cell.noOfHorizontalMergedCells);
            }
            else {
                colPosition.push(selectedCell[i].pos.column);
            }
        }

        for (let i = 0; i < selectedCell.length; i++) {
            if (selectedCell[i].cell.noOfVerticalMergedCells && !demerge) {
                rowPositions.push(selectedCell[i].pos.row + selectedCell[i].cell.noOfVerticalMergedCells);
            }
            else {
                rowPositions.push(selectedCell[i].pos.row);
            }
        }

        const startRowNo = Math.min(...rowPositions);
        const endRowNo = Math.max(...rowPositions);
        const startColNo = Math.min(...colPosition);
        const endColNo = Math.max(...colPosition);

        const allRows = this.getRows();
        for (let i = startRowNo; i <= endRowNo; i++) {
            const row = [];
            for (let j = startColNo; j <= endColNo; j++) {
                row.push({
                    cell: allRows[i][j],
                    pos: {row: i, column: j},
                });
            }
            cells.push(row);
        }
        return cells
    }

    // exportDxfData(dxfData) {
    //     const line = [];
    //     const text = [];

    //     this.lines.forEach((object) => {
    //         line.push({
    //             point1: this.getCoordinatesWrtCenter({ x: object.x1, y: object.y1, z: 0 }),
    //             point2: this.getCoordinatesWrtCenter({ x: object.x2, y: object.y2, z: 0 }),
    //         })
    //     })

    //     this.texts.forEach(object => {
    //         if (!object.cellMergedFlag) {
    //             text.push({
    //                 point: this.getCoordinatesWrtCenter({ x: object.point.x, y: object.point.y}),
    //                 text: object.text,
    //                 width: object.fixedWidth * 0.01,
    //             })
    //         }
    //     })

    //     dxfData.table.push({
    //         lines: line,
    //         texts: text,
    //         point: { x: this.position.x, y: this.position.y, z: 0},
    //         noOfRows: this.noOfRows,
    //         noOfColumns: this.noOfColumns,
    //         rowHeight: this.rowHeight,
    //         columnWidth: this.columnWidth,
    //         cells: this.cells,
    //     })
    // }

    // getCoordinatesWrtCenter(point) {
    //     return {
    //         x: point.x - (this.canvas.width / 2),
    //         y: (this.canvas.height / 2) - point.y,
    //         z: 0,
    //     } 
    // }
}

export class Cell {
    constructor(cellText, cellMergedFlag= false, cellVerticalMergedFlag = false, options = {}) {
        this.cellText = cellText;
        this.cellMergedFlag = cellMergedFlag;
        this.cellVerticalMergedFlag = cellVerticalMergedFlag;
        this.noOfHorizontalMergedCells = 0;
        this.noOfVerticalMergedCells = 0;
        if (options.underline) this.cellTextUnderline = options.underline;
        else this.cellTextUnderline = false;
        if (options.textWeight) this.cellTextWeigth = options.textWeight;
        else this.cellTextWeigth = 'normal';
        if (options.textStyle) this.cellTextStyle = options.textStyle;
        else this.cellTextStyle = 'normal';
        if (options.editable) this.editable = options.editable;
        else options.editable = false;
    }

    // updateObject(properties) {
    //     if(properties.hasOwnProperty('cellText') &&
    //         properties.cellText !== this.cellText) {
    //             this.cellText = properties.cellText;
    //     }
    // }

    saveObject() {
        const saveData = {
            cellText: this.cellText,
            cellMergedFlag: this.cellMergedFlag,
            options: this.options,
        }
        return saveData
    }

    loadObject(loadData) {
        this.cellText = loadData.cellText;
        this.cellMergedFlag = loadData.cellMergedFlag;
        this.options = loadData.options;
    }
}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}