import * as React from 'react';
import { ExampleCard, IComponentDemoPageProps, ComponentPage, PropertiesTableSet } from '@uifabric/example-app-base';
import { DashboardGridLayoutExample } from './examples/DashboardGridLayout.Example';
import { DashboardGridLayoutCardExample } from './examples/DashboardGridLayout.Card.Example';
const DashboardGridLayoutExampleCode = require('!raw-loader!@uifabric/dashboard-grid-layout/src/components/DashboardGridLayout/examples/DashboardGridLayout.Example.tsx') as string;
const DashboardGridLayoutCardExampleCode = require('!raw-loader!@uifabric/dashboard-grid-layout/src/components/DashboardGridLayout/examples/DashboardGridLayout.Card.Example.tsx') as string;

export class DashboardGridLayoutPage extends React.Component<IComponentDemoPageProps, {}> {
  public render(): JSX.Element {
    return (
      <ComponentPage
        title="DashboardGridLayout"
        componentName="DashboardGridLayout"
        exampleCards={
          <div>
            <ExampleCard
              title="DashboardGridLayout"
              isScrollable={true}
              isOptIn={true}
              code={DashboardGridLayoutExampleCode}
            >
              <DashboardGridLayoutExample />
            </ExampleCard>
            <ExampleCard
              title="DashboardGridLayout with cards"
              isScrollable={true}
              isOptIn={true}
              code={DashboardGridLayoutCardExampleCode}
            >
              <DashboardGridLayoutCardExample />
            </ExampleCard>
          </div>
        }
        propertiesTables={
          <PropertiesTableSet
            sources={[
              require<
                string
              >('!raw-loader!@uifabric/dashboard-grid-layout/src/components/DashboardGridLayout/DashboardGridLayout.types.ts')
            ]}
            renderOnly={['IDashboardGridLayoutProps', 'DashboardGridBreakpointLayouts', 'IDashboardCardLayout']}
          />
        }
        overview={
          <div>
            This component is built using <a href="https://github.com/STRML/react-grid-layout">react-grid-layout</a>{' '}
            with a specific layout and breakpoint constraint for dashboard with cards.
          </div>
        }
        bestPractices={<div />}
        dos={
          <div>
            <ul>
              <li>Use the layout property to define how cards should load for the first time</li>
              <li>
                Use the optional draggable property to define whether or not items in dashboard are draggable or not
              </li>
              <li>
                Use the fabric cards inside of this dashboard since breakpoints and column constraints work best with a
                card component
              </li>
            </ul>
          </div>
        }
        donts={
          <div>
            <ul>
              <li>
                Use this grid layout in a single column, or with invalid layout property which will cause it to render
                in one column
              </li>
            </ul>
          </div>
        }
        isHeaderVisible={this.props.isHeaderVisible}
      />
    );
  }
}
