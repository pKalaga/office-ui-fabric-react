import { IColumn } from './DetailsList.types';
import { IDetailsRowStyles } from './DetailsRow.types';

export interface IDetailsRowFieldsProps {
  /**
   * Ref of component
   */
  componentRef?: () => void;

  /**
   * Data source for this component
   */
  item: any;

  /**
   * The item index of the collection for the DetailsList
   */
  itemIndex: number;

  /**
   * Index to start for the column
   */
  columnStartIndex: number;

  /**
   * Columns metadata
   */
  columns: IColumn[];

  /**
   * whether to render as a compact field
   */
  compact?: boolean;

  /**
   * Callback for rendering an item column
   */
  onRenderItemColumn?: (item?: any, index?: number, column?: IColumn) => any;

  /**
   * Whether to show shimmer
   */
  shimmer?: boolean;

  /**
   * Required prop to be passed in from the parent DetailsRow a map of classNames and its mergestyle-created classNames
   */
  rowClassNames: { [className in keyof IDetailsRowStyles]: string };
}
