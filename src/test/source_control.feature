Feature: Source Control
        As a user,
        I want to be able to review my changes
        so that I can decide whether to push through or discard it

Rule: Global scope

Scenario: Commit changes
    Given there are file changes
    When the user commits all changes
    Then the changes will be pushed to xray
    And there will be no more changes at all

Scenario: Commit changes after adding scenarios from orphans
    Given the user added an orphaned scenario to a feature
    When the user commits all changes
    Then the added scenarios from orphans will no longer be visible in the orphans view

Scenario: Commit changes after removing scenarios
    Given the user removed some scenarios in a feature
    When the user commits all changes
    Then the removed scenarios will now be visible in the orphans view

Scenario: Committing changes refreshes the workspace
    Given there are file changes
    When the user commits all changes
    Then any changes from origin will get reflected in the explorer

Scenario: Commting changes after reordering scenarios
    Given the user reorders the scenarios in a feature
    When the user commits all changes
    Then the order of scenarios gets retained after refresh

Scenario: Discard all changes
    Given there are file changes
    When the user discards all changes
    Then all the changes will be in their origin state
    And there will be no more changes at all

Rule: Resource group scope

Scenario: Discard group changes
    Given there are file changes
    When the user discards all group changes
    Then all the changes will revert back to their origin state
    And there will be no more changes for this resource group

Rule: Folder scope

Scenario: Discard all folder changes
    Given there are file changes
    When the user discards all folder changes
    Then all the changes will revert back to their origin state
    And there will be no more changes for this folder

Rule: Resource scope

Scenario: Discard changes
    Given there are file changes
    When the user discard changes
    Then the file will revert back to its origin state

Scenario: Open file
    When the user opens a file
    Then an editor opens showing only the changes

Scenario: Select file
    When the user selects a file
    Then a diff editor opens showing the origin in the left and the changes in the right