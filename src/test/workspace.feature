Feature: Workspace
    As a user,
    I want to be able to setup a workspace
    so that I can connect to Xray

Scenario: Xray settings
    When the user views the Xray Beams settings
    Then the settings shown are the ff
        | label              |
        | Jira: Base Url     |
        | Jira > Jql: Orphan |
        | Jira: Project Key  |
        | Jira: Username     |

Scenario: view setup workspace command pallete
    Given vscode window with no open workspace
    When the user views the command palette
    Then the "XrayBeams: Setup Workspace" should be available

Scenario: Setup workspace where Xray Beams settings is not yet saved
    When the user selects "XrayBeams: Setup Workspace" command in the command palette
    Then the app will prompt for "XrayBeams: Jira password"

Scenario: Setup Workspace where Xray Beams settings is already saved
    When the user selects "XrayBeams: Setup Workspace" command in the command palette
    Then the app will prompt for the ff
        | label                    |
        | XrayBeams: Base URL      |
        | XrayBeams: Project Key   |
        | XrayBeams: Orphans JQL   |
        | XrayBeams: Jira Username |
        | XrayBeams: Jira Password |

Scenario: Open existing workspace
    When the user opens an existing Xray Beams workspace
    Then the app will prompt for "XrayBeams: Jira password"

Scenario: Refresh unauthenticated workspace
    When the user selects "XrayBeams: Refresh" command in the command palette
    Then the app will prompt for "XrayBeams: Jira password"

Scenario: Refresh workspace with no pending changes
    When the user selects "XrayBeams: Refresh" command in the command palette
    Then any changes from origin will get reflected in the explorer

Scenario: Refresh workspace with pending changes
    When the user selects "XrayBeams: Refresh" command in the command palette
    Then any changes from origin will get reflected in the explorer
    And the pending changes will get retained