import * as React from 'react';
import { findDOMNode } from 'react-dom';
import { BaseComponent, css, getRTL, getId, KeyCodes, IRenderFunction, createRef, IClassNames } from '../../Utilities';
import { IColumn, IDetailsHeaderProps } from './DetailsList.types';
import { IFocusZone, FocusZone, FocusZoneDirection } from '../../FocusZone';
import { Icon } from '../../Icon';
import { Layer } from '../../Layer';
import { GroupSpacer } from '../GroupedList/GroupSpacer';
import { CollapseAllVisibility } from '../../GroupedList';
import { DetailsRowCheck } from './DetailsRowCheck';
import { ITooltipHostProps } from '../../Tooltip';
import { ISelection, SelectionMode, SELECTION_CHANGE } from '../../utilities/selection/interfaces';
import { IDragDropOptions } from '../../utilities/dragdrop/interfaces';
import { DragDropHelper } from '../../utilities/dragdrop';
import { DetailsColumn } from '../../components/DetailsList/DetailsColumn';
import { IColumnResizeDetails, SelectAllVisibility, IDropHintDetails } from './DetailsHeader.types';
import { IDetailsHeaderStyleProps, IDetailsHeaderStyles } from './DetailsHeader.types';
import { classNamesFunction } from '../../Utilities';

export const getClassNames = classNamesFunction<IDetailsHeaderStyleProps, IDetailsHeaderStyles>();

const MOUSEDOWN_PRIMARY_BUTTON = 0; // for mouse down event we are using ev.button property, 0 means left button
const MOUSEMOVE_PRIMARY_BUTTON = 1; // for mouse move event we are using ev.buttons property, 1 means left button

export interface IDetailsHeader {
  focus: () => boolean;
}

export interface IDetailsHeaderState {
  columnResizeDetails?: IColumnResizeDetails;
  isAllSelected?: boolean;
  isSizing?: boolean;
  groupNestingDepth?: number;
  isAllCollapsed?: boolean;
}

export class DetailsHeaderBase extends BaseComponent<IDetailsHeaderProps, IDetailsHeaderState>
  implements IDetailsHeader {
  public static defaultProps = {
    selectAllVisibility: SelectAllVisibility.visible,
    collapseAllVisibility: CollapseAllVisibility.visible
  };
  private _classNames: IClassNames<IDetailsHeaderStyles>;
  private _rootElement: HTMLElement | undefined;
  private _rootComponent = createRef<IFocusZone>();
  private _id: string;
  private _draggedColumnIndex = -1;
  private _dropHintDetails: { [key: number]: IDropHintDetails } = {};
  private _dragDropHelper: DragDropHelper | null;
  private _currentDropHintIndex: number;
  private _subscriptionObject: {
    key: string;
    dispose(): void;
  };
  private _onDropIndexInfo: {
    sourceIndex: number;
    targetIndex: number;
  };
  constructor(props: IDetailsHeaderProps) {
    super(props);

    this.state = {
      columnResizeDetails: undefined,
      groupNestingDepth: this.props.groupNestingDepth,
      isAllCollapsed: this.props.isAllCollapsed
    };

    this._onToggleCollapseAll = this._onToggleCollapseAll.bind(this);
    this._onSelectAllClicked = this._onSelectAllClicked.bind(this);
    this._setDraggedItemIndex = this._setDraggedItemIndex.bind(this);
    this._onDragOver = this._onDragOver.bind(this);
    this._onDrop = this._onDrop.bind(this);
    this._getHeaderDragDropOptions = this._getHeaderDragDropOptions.bind(this);
    this._updateDroppingState = this._updateDroppingState.bind(this);
    this._getDropHintPositions = this._getDropHintPositions.bind(this);
    this._computeDropHintToBeShown = this._computeDropHintToBeShown.bind(this);
    this._resetDropHints = this._resetDropHints.bind(this);
    this._isValidCurrentDropHintIndex = this._isValidCurrentDropHintIndex.bind(this);
    this._onRootRef = this._onRootRef.bind(this);
    this._onDropIndexInfo = {
      sourceIndex: Number.MIN_SAFE_INTEGER,
      targetIndex: Number.MIN_SAFE_INTEGER
    };
    this._id = getId('header');
    this._currentDropHintIndex = Number.MIN_SAFE_INTEGER;
  }

  public componentDidMount(): void {
    const { selection, columnReorderOptions } = this.props;

    this._events.on(selection, SELECTION_CHANGE, this._onSelectionChanged);

    // We need to use native on this to avoid MarqueeSelection from handling the event before us.
    this._events.on(this._rootElement!, 'mousedown', this._onRootMouseDown);

    this._events.on(this._rootElement!, 'keydown', this._onRootKeyDown);

    if (columnReorderOptions) {
      this._subscriptionObject = this._dragDropHelper!.subscribe(
        this._rootElement!,
        this._events,
        this._getHeaderDragDropOptions()
      );
    }
  }

  public componentDidUpdate(prevProps: IDetailsHeaderProps): void {
    const { columnReorderOptions } = this.props;

    if (!columnReorderOptions) {
      if (this._subscriptionObject) {
        this._subscriptionObject.dispose();
        delete this._subscriptionObject;
      }
    } else if (!this._subscriptionObject) {
      this._subscriptionObject = this._dragDropHelper!.subscribe(
        this._rootElement!,
        this._events,
        this._getHeaderDragDropOptions()
      );
    }

    if (this.props !== prevProps && this._onDropIndexInfo.sourceIndex >= 0 && this._onDropIndexInfo.targetIndex >= 0) {
      if (
        prevProps.columns[this._onDropIndexInfo.sourceIndex].key ===
        this.props.columns[this._onDropIndexInfo.targetIndex].key
      ) {
        this._onDropIndexInfo = {
          sourceIndex: Number.MIN_SAFE_INTEGER,
          targetIndex: Number.MIN_SAFE_INTEGER
        };
      }
    }
  }

  public componentWillReceiveProps(newProps: IDetailsHeaderProps): void {
    const { groupNestingDepth } = this.state;

    if (newProps.groupNestingDepth !== groupNestingDepth) {
      this.setState({ groupNestingDepth: newProps.groupNestingDepth });
    }
  }

  public componentWillUnmount(): void {
    if (this._subscriptionObject) {
      this._subscriptionObject.dispose();
      delete this._subscriptionObject;
    }
  }

  public render(): JSX.Element {
    const {
      columns,
      ariaLabel,
      ariaLabelForSelectAllCheckbox,
      selectAllVisibility,
      ariaLabelForSelectionColumn,
      indentWidth,
      viewport,
      columnReorderOptions,
      onColumnClick,
      onColumnContextMenu,
      styles,
      theme
    } = this.props;
    const { isAllSelected, columnResizeDetails, isSizing, groupNestingDepth, isAllCollapsed } = this.state;
    const showCheckbox = selectAllVisibility !== SelectAllVisibility.none;
    const isCheckboxHidden = selectAllVisibility === SelectAllVisibility.hidden;

    const { onRenderColumnHeaderTooltip = this._onRenderColumnHeaderTooltip } = this.props;
    if (!this._dragDropHelper && this.props.columnReorderOptions) {
      this._dragDropHelper = new DragDropHelper({
        selection: {
          getSelection: () => {
            return;
          }
        } as ISelection,
        minimumPixelsForDrag: this.props.minimumPixelsForDrag
      });
    }
    const frozenColumnCountFromStart =
      columnReorderOptions && columnReorderOptions!.frozenColumnCountFromStart
        ? columnReorderOptions!.frozenColumnCountFromStart!
        : 0;
    const frozenColumnCountFromEnd =
      columnReorderOptions && columnReorderOptions!.frozenColumnCountFromEnd
        ? columnReorderOptions!.frozenColumnCountFromEnd!
        : 0;

    this._classNames = getClassNames(styles, {
      theme: theme!,
      isAllSelected,
      isSelectAllHidden: selectAllVisibility === SelectAllVisibility.hidden,
      isResizingColumn: !!columnResizeDetails && isSizing,
      isSizing,
      isAllCollapsed,
      isCheckboxHidden
    });

    const classNames = this._classNames;

    return (
      <FocusZone
        role="row"
        aria-label={ariaLabel}
        className={classNames.root}
        componentRef={this._rootComponent}
        ref={this._onRootRef}
        onMouseMove={this._onRootMouseMove}
        data-automationid="DetailsHeader"
        style={{ minWidth: viewport ? viewport.width : 0 }}
        direction={FocusZoneDirection.horizontal}
      >
        {showCheckbox
          ? [
              <div
                key="__checkbox"
                className={classNames.cellIsCheck}
                aria-labelledby={`${this._id}-check`}
                onClick={this._onSelectAllClicked}
                aria-colindex={!isCheckboxHidden ? 1 : undefined}
                role={!isCheckboxHidden ? 'columnheader' : undefined}
              >
                {onRenderColumnHeaderTooltip(
                  {
                    hostClassName: css(classNames.checkTooltip),
                    id: `${this._id}-checkTooltip`,
                    setAriaDescribedBy: false,
                    content: ariaLabelForSelectAllCheckbox,
                    children: (
                      <DetailsRowCheck
                        id={`${this._id}-check`}
                        aria-label={ariaLabelForSelectionColumn}
                        aria-describedby={`${this._id}-checkTooltip`}
                        data-is-focusable={!isCheckboxHidden}
                        isHeader={true}
                        selected={isAllSelected}
                        anySelected={false}
                        canSelect={!isCheckboxHidden}
                        className={classNames.check}
                      />
                    )
                  },
                  this._onRenderColumnHeaderTooltip
                )}
              </div>,
              ariaLabelForSelectAllCheckbox && !this.props.onRenderColumnHeaderTooltip ? (
                <label key="__checkboxLabel" id={`${this._id}-checkTooltip`} className={classNames.accessibleLabel}>
                  {ariaLabelForSelectAllCheckbox}
                </label>
              ) : null
            ]
          : null}
        {groupNestingDepth! > 0 && this.props.collapseAllVisibility === CollapseAllVisibility.visible ? (
          <div className={classNames.cell} onClick={this._onToggleCollapseAll} data-is-focusable={true}>
            <Icon className={classNames.collapseButton} iconName="ChevronDown" />
          </div>
        ) : null}
        <GroupSpacer indentWidth={indentWidth} count={groupNestingDepth! - 1} />
        {columns.map((column: IColumn, columnIndex: number) => {
          const _isDraggable = columnReorderOptions
            ? columnIndex >= frozenColumnCountFromStart && columnIndex < columns.length - frozenColumnCountFromEnd
            : false;
          return [
            columnReorderOptions &&
              (_isDraggable || columnIndex === columns.length - frozenColumnCountFromEnd) &&
              this._renderDropHint(columnIndex),
            <DetailsColumn
              column={column}
              key={column.key}
              columnIndex={(showCheckbox ? 2 : 1) + columnIndex}
              parentId={this._id}
              isDraggable={_isDraggable}
              setDraggedItemIndex={this._setDraggedItemIndex}
              dragDropHelper={this._dragDropHelper}
              onColumnClick={onColumnClick}
              onColumnContextMenu={onColumnContextMenu}
              isDropped={this._onDropIndexInfo.targetIndex === columnIndex}
              headerClassNames={classNames}
            />,
            column.isResizable && this._renderColumnSizer(columnIndex)
          ];
        })}
        {columnReorderOptions && frozenColumnCountFromEnd === 0 && this._renderDropHint(columns.length)}
        {isSizing && (
          <Layer>
            <div
              className={classNames.sizingOverlay}
              onMouseMove={this._onSizerMouseMove}
              onMouseUp={this._onSizerMouseUp}
            />
          </Layer>
        )}
      </FocusZone>
    );
  }

  /** Set focus to the active thing in the focus area. */
  public focus(): boolean {
    return Boolean(this._rootComponent.current && this._rootComponent.current.focus());
  }

  private _getHeaderDragDropOptions(): IDragDropOptions {
    const options = {
      selectionIndex: 1,
      context: { data: this, index: 0 },
      canDrag: () => false,
      canDrop: () => true,
      onDragStart: () => undefined,
      updateDropState: this._updateDroppingState,
      onDrop: this._onDrop,
      onDragEnd: () => undefined,
      onDragOver: this._onDragOver
    };
    return options;
  }

  private _updateDroppingState(newValue: boolean, event: DragEvent): void {
    if (this._draggedColumnIndex >= 0 && event.type !== 'drop') {
      if (!newValue) {
        this._resetDropHints();
      }
    }
  }

  private _isValidCurrentDropHintIndex() {
    return this._currentDropHintIndex! >= 0;
  }

  private _onDragOver(item: any, event: DragEvent): void {
    if (this._draggedColumnIndex >= 0) {
      event.stopPropagation();
      this._computeDropHintToBeShown(event.clientX);
    }
  }

  private _onDrop(item?: any, event?: DragEvent): void {
    const draggedColumnIndex = this._draggedColumnIndex;
    // Target index will not get changed if draggeditem is after target item.
    const targetIndex =
      draggedColumnIndex > this._currentDropHintIndex! ? this._currentDropHintIndex! : this._currentDropHintIndex! - 1;
    let isValidDrop = false;
    if (this._draggedColumnIndex >= 0 && event! instanceof DragEvent) {
      event!.stopPropagation();
      if (this._isValidCurrentDropHintIndex()) {
        isValidDrop = true;
        this._onDropIndexInfo.sourceIndex = draggedColumnIndex;
        this._onDropIndexInfo.targetIndex = targetIndex;
      }
      this._resetDropHints();
      this._dropHintDetails = {};
      this._draggedColumnIndex = -1;
      if (isValidDrop) {
        this.props.columnReorderOptions!.handleColumnReorder(draggedColumnIndex, targetIndex);
      }
    }
  }

  private _setDraggedItemIndex(itemIndex: number) {
    if (itemIndex >= 0) {
      // Column index is set based on the checkbox
      this._draggedColumnIndex = this.props.selectionMode !== SelectionMode.none ? itemIndex - 2 : itemIndex - 1;
      this._getDropHintPositions();
    } else {
      this._resetDropHints();
      this._draggedColumnIndex = -1;
      this._dropHintDetails = {};
    }
  }

  private _resetDropHints(): void {
    if (this._currentDropHintIndex >= 0) {
      this._updateDropHintElement(this._dropHintDetails[this._currentDropHintIndex].dropHintElementRef, 'hidden');
      this._currentDropHintIndex = Number.MIN_SAFE_INTEGER;
    }
  }

  private _updateDropHintElement(element: HTMLElement, property: string) {
    (element.childNodes[1] as HTMLElement).style.visibility = property;
    (element.childNodes[0] as HTMLElement).style.visibility = property;
  }

  private _getDropHintPositions = (): void => {
    const { columnReorderOptions, columns } = this.props;
    let prevX = 0;
    let prevMid = 0;
    let prevRef: HTMLElement;
    const frozenColumnCountFromStart =
      columnReorderOptions && columnReorderOptions!.frozenColumnCountFromStart
        ? columnReorderOptions!.frozenColumnCountFromStart
        : 0;
    const frozenColumnCountFromEnd =
      columnReorderOptions && columnReorderOptions!.frozenColumnCountFromEnd
        ? columnReorderOptions!.frozenColumnCountFromEnd
        : 0;
    for (let i = frozenColumnCountFromStart!; i < columns.length - frozenColumnCountFromEnd! + 1; i++) {
      const dropHintElement = this._rootElement!.querySelectorAll('#columnDropHint_' + i)[0] as HTMLElement;
      if (dropHintElement) {
        if (i === frozenColumnCountFromStart!) {
          prevX = dropHintElement!.offsetLeft;
          prevMid = dropHintElement!.offsetLeft;
          prevRef = dropHintElement;
        } else {
          const newMid = (dropHintElement!.offsetLeft + prevX!) / 2;
          this._dropHintDetails[i - 1] = {
            originX: prevX,
            startX: prevMid!,
            endX: newMid,
            dropHintElementRef: prevRef!
          };
          prevMid = newMid;
          prevRef = dropHintElement;
          prevX = dropHintElement!.offsetLeft;
          if (i === columns.length - frozenColumnCountFromEnd!) {
            this._dropHintDetails[i] = {
              originX: prevX,
              startX: prevMid!,
              endX: dropHintElement!.offsetLeft,
              dropHintElementRef: prevRef
            };
          }
        }
      }
    }
  };

  /**
   * Based on the given cursor position, finds the nearest drop hint and updates the state to make it visible
   *
   */
  private _computeDropHintToBeShown = (clientX: number): void => {
    const clientRect = this._rootElement!.getBoundingClientRect();
    const headerOriginX = clientRect.left;
    const eventXRelativePosition = clientX - headerOriginX;
    const currentDropHintIndex = this._currentDropHintIndex!;
    if (this._isValidCurrentDropHintIndex()) {
      if (
        eventXRelativePosition >= this._dropHintDetails[currentDropHintIndex!].startX &&
        eventXRelativePosition <= this._dropHintDetails[currentDropHintIndex!].endX
      ) {
        return;
      }
    }
    const { columnReorderOptions, columns } = this.props;
    const frozenColumnCountFromStart =
      columnReorderOptions && columnReorderOptions!.frozenColumnCountFromStart
        ? columnReorderOptions!.frozenColumnCountFromStart
        : 0;
    const frozenColumnCountFromEnd =
      columnReorderOptions && columnReorderOptions!.frozenColumnCountFromEnd
        ? columnReorderOptions!.frozenColumnCountFromEnd
        : 0;
    const currentIndex: number = frozenColumnCountFromStart!;
    const lastValidColumn = columns.length - frozenColumnCountFromEnd!;
    let indexToUpdate = -1;
    if (eventXRelativePosition <= this._dropHintDetails[currentIndex].endX) {
      indexToUpdate = currentIndex;
    } else if (eventXRelativePosition >= this._dropHintDetails[lastValidColumn]!.startX) {
      indexToUpdate = lastValidColumn;
    } else if (this._isValidCurrentDropHintIndex()) {
      if (
        this._dropHintDetails[currentDropHintIndex! + 1] &&
        eventXRelativePosition >= this._dropHintDetails[currentDropHintIndex! + 1].startX &&
        eventXRelativePosition <= this._dropHintDetails[currentDropHintIndex! + 1].endX
      ) {
        indexToUpdate = currentDropHintIndex! + 1;
      } else if (
        this._dropHintDetails[currentDropHintIndex! - 1] &&
        eventXRelativePosition >= this._dropHintDetails[currentDropHintIndex! - 1].startX &&
        eventXRelativePosition <= this._dropHintDetails[currentDropHintIndex! - 1].endX
      ) {
        indexToUpdate = currentDropHintIndex! - 1;
      }
    }
    if (indexToUpdate === -1) {
      let startIndex = frozenColumnCountFromStart!;
      let endIndex = lastValidColumn;
      while (startIndex < endIndex) {
        const middleIndex = Math.ceil((endIndex + startIndex!) / 2);
        if (
          eventXRelativePosition >= this._dropHintDetails[middleIndex].startX &&
          eventXRelativePosition <= this._dropHintDetails[middleIndex].endX
        ) {
          indexToUpdate = middleIndex;
          break;
        } else if (eventXRelativePosition < this._dropHintDetails[middleIndex]!.originX) {
          endIndex = middleIndex;
        } else if (eventXRelativePosition > this._dropHintDetails[middleIndex]!.originX) {
          startIndex = middleIndex;
        }
      }
    }

    if (indexToUpdate === this._draggedColumnIndex || indexToUpdate === this._draggedColumnIndex + 1) {
      if (this._isValidCurrentDropHintIndex()) {
        this._resetDropHints();
      }
    } else if (currentDropHintIndex !== indexToUpdate && indexToUpdate >= 0) {
      this._resetDropHints();
      this._updateDropHintElement(this._dropHintDetails[indexToUpdate].dropHintElementRef, 'visible');
      this._currentDropHintIndex = indexToUpdate;
    }
  };

  private _renderColumnSizer(columnIndex: number): JSX.Element {
    const { columns } = this.props;
    const column = this.props.columns[columnIndex];
    const { columnResizeDetails } = this.state;
    const classNames = this._classNames;

    return (
      <div
        key={`${column.key}_sizer`}
        aria-hidden={true}
        role="button"
        data-is-focusable={false}
        onClick={stopPropagation}
        data-sizer-index={columnIndex}
        onBlur={this._onSizerBlur}
        className={css(
          classNames.cellSizer,
          columnIndex < columns.length - 1 ? classNames.cellSizerStart : classNames.cellSizerEnd,
          {
            [classNames.cellIsResizing]: columnResizeDetails && columnResizeDetails.columnIndex === columnIndex
          }
        )}
        onDoubleClick={this._onSizerDoubleClick.bind(this, columnIndex)}
      />
    );
  }

  private _renderDropHint(dropHintIndex: number): JSX.Element {
    const classNames = this._classNames;
    return (
      <div key={'dropHintKey'} className={classNames.dropHintStyle} id={`columnDropHint_${dropHintIndex}`}>
        <div
          key={`dropHintCircleKey`}
          aria-hidden={true}
          data-is-focusable={false}
          data-sizer-index={dropHintIndex}
          className={classNames.dropHintCircleStyle}
        />
        <div
          key={`dropHintLineKey`}
          aria-hidden={true}
          data-is-focusable={false}
          data-sizer-index={dropHintIndex}
          className={classNames.dropHintLineStyle}
        />
      </div>
    );
  }
  private _onRenderColumnHeaderTooltip = (
    tooltipHostProps: ITooltipHostProps,
    defaultRender?: IRenderFunction<ITooltipHostProps>
  ): JSX.Element => {
    return <span className={tooltipHostProps.hostClassName}>{tooltipHostProps.children}</span>;
  };

  /**
   * double click on the column sizer will auto ajust column width
   * to fit the longest content among current rendered rows.
   *
   * @private
   * @param {number} columnIndex (index of the column user double clicked)
   * @param {React.MouseEvent} ev (mouse double click event)
   */
  private _onSizerDoubleClick(columnIndex: number, ev: React.MouseEvent<HTMLElement>): void {
    const { onColumnAutoResized, columns } = this.props;
    if (onColumnAutoResized) {
      onColumnAutoResized(columns[columnIndex], columnIndex);
    }
  }

  /**
   * Called when the select all toggle is clicked.
   */
  private _onSelectAllClicked = (): void => {
    const { selection } = this.props;

    selection.toggleAllSelected();
  };

  private _onRootMouseDown = (ev: MouseEvent): void => {
    const columnIndexAttr = (ev.target as HTMLElement).getAttribute('data-sizer-index');
    const columnIndex = Number(columnIndexAttr);
    const { columns } = this.props;

    if (columnIndexAttr === null || ev.button !== MOUSEDOWN_PRIMARY_BUTTON) {
      // Ignore anything except the primary button.
      return;
    }

    this.setState({
      columnResizeDetails: {
        columnIndex: columnIndex,
        columnMinWidth: columns[columnIndex].calculatedWidth!,
        originX: ev.clientX
      }
    });

    ev.preventDefault();
    ev.stopPropagation();
  };

  private _onRootMouseMove = (ev: React.MouseEvent<HTMLElement>): void => {
    const { columnResizeDetails, isSizing } = this.state;

    if (columnResizeDetails && !isSizing && ev.clientX !== columnResizeDetails.originX) {
      this.setState({ isSizing: true });
    }
  };

  private _onRootRef = (focusZone: FocusZone): void => {
    if (focusZone) {
      // Need to resolve the actual DOM node, not the component. The element itself will be used for drag/drop and focusing.
      this._rootElement = findDOMNode(focusZone) as HTMLElement;
    } else {
      this._rootElement = undefined;
    }
  };

  private _onRootKeyDown = (ev: KeyboardEvent): void => {
    const { columnResizeDetails, isSizing } = this.state;
    const { columns, onColumnResized } = this.props;

    const columnIndexAttr = (ev.target as HTMLElement).getAttribute('data-sizer-index');

    if (!columnIndexAttr || isSizing) {
      return;
    }

    const columnIndex = Number(columnIndexAttr);

    if (!columnResizeDetails) {
      if (ev.which === KeyCodes.enter) {
        this.setState({
          columnResizeDetails: {
            columnIndex: columnIndex,
            columnMinWidth: columns[columnIndex].calculatedWidth!
          }
        });

        ev.preventDefault();
        ev.stopPropagation();
      }
    } else {
      let increment: number | undefined;

      if (ev.which === KeyCodes.enter) {
        this.setState({
          columnResizeDetails: undefined
        });

        ev.preventDefault();
        ev.stopPropagation();
      } else if (ev.which === KeyCodes.left) {
        increment = getRTL() ? 1 : -1;
      } else if (ev.which === KeyCodes.right) {
        increment = getRTL() ? -1 : 1;
      }

      if (increment) {
        if (!ev.shiftKey) {
          increment *= 10;
        }

        this.setState({
          columnResizeDetails: {
            ...columnResizeDetails,
            columnMinWidth: columnResizeDetails.columnMinWidth + increment
          }
        });

        if (onColumnResized) {
          onColumnResized(columns[columnIndex], columnResizeDetails.columnMinWidth + increment, columnIndex);
        }

        ev.preventDefault();
        ev.stopPropagation();
      }
    }
  };

  /**
   * mouse move event handler in the header
   * it will set isSizing state to true when user clicked on the sizer and move the mouse.
   *
   * @private
   * @param {React.MouseEvent} ev (mouse move event)
   */
  private _onSizerMouseMove = (ev: React.MouseEvent<HTMLElement>): void => {
    const {
      // use buttons property here since ev.button in some edge case is not upding well during the move.
      // but firefox doesn't support it, so we set the default value when it is not defined.
      buttons
    } = ev;
    const { onColumnIsSizingChanged, onColumnResized, columns } = this.props;
    const { columnResizeDetails } = this.state;

    if (buttons !== undefined && buttons !== MOUSEMOVE_PRIMARY_BUTTON) {
      // cancel mouse down event and return early when the primary button is not pressed
      this._onSizerMouseUp(ev);
      return;
    }

    if (ev.clientX !== columnResizeDetails!.originX) {
      if (onColumnIsSizingChanged) {
        onColumnIsSizingChanged(columns[columnResizeDetails!.columnIndex], true);
      }
    }

    if (onColumnResized) {
      let movement = ev.clientX - columnResizeDetails!.originX!;

      if (getRTL()) {
        movement = -movement;
      }

      onColumnResized(
        columns[columnResizeDetails!.columnIndex],
        columnResizeDetails!.columnMinWidth + movement,
        columnResizeDetails!.columnIndex
      );
    }
  };

  private _onSizerBlur = (ev: React.FocusEvent<HTMLElement>): void => {
    const { columnResizeDetails } = this.state;

    if (columnResizeDetails) {
      this.setState({
        columnResizeDetails: undefined,
        isSizing: false
      });
    }
  };

  /**
   * mouse up event handler in the header
   * clear the resize related state.
   * This is to ensure we can catch double click event
   *
   * @private
   * @param {React.MouseEvent} ev (mouse up event)
   */
  private _onSizerMouseUp = (ev: React.MouseEvent<HTMLElement>): void => {
    const { columns, onColumnIsSizingChanged } = this.props;
    const { columnResizeDetails } = this.state;

    this.setState({
      columnResizeDetails: undefined,
      isSizing: false
    });

    if (onColumnIsSizingChanged) {
      onColumnIsSizingChanged(columns[columnResizeDetails!.columnIndex], false);
    }
  };

  private _onSelectionChanged(): void {
    const isAllSelected = this.props.selection.isAllSelected();

    if (this.state.isAllSelected !== isAllSelected) {
      this.setState({
        isAllSelected: isAllSelected
      });
    }
  }

  private _onToggleCollapseAll(): void {
    const { onToggleCollapseAll } = this.props;
    const newCollapsed = !this.state.isAllCollapsed;
    this.setState({
      isAllCollapsed: newCollapsed
    });
    if (onToggleCollapseAll) {
      onToggleCollapseAll(newCollapsed);
    }
  }
}

function stopPropagation(ev: React.MouseEvent<HTMLElement>): void {
  ev.stopPropagation();
}
