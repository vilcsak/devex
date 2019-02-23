import geb.spock.GebReportingSpec
import geb.*

import pages.app.HomePage
import pages.app.OpportunitiesPage

import spock.lang.Unroll
import spock.lang.Narrative
import spock.lang.Title
import spock.lang.Stepwise

//import org.openqa.selenium.WebElement
//import org.openqa.selenium.By



@Narrative('''In this test, the ADMIN will delete the existing opportunities: one CWU and one SWU
 ''')

@Stepwise //Order is important, as the second element of the list must be deleted first

@Title("Admin Deletes opportunities")
class AdminDeletesOpportunity extends GebReportingSpec {         
    def setup() {
        to HomePage
        // Need to login as an admin
        def  loginOK= login."Login As An Administrator"("admin","adminadmin","Admin Local")
        assert loginOK
    } 

    def "Admin Deletes an CWU opportunity" () {
    
        given: "Starting from the Opportunities Page"
            waitFor {to OpportunitiesPage}

        when: "Click on the second entry of the list: it is a CWU opportunity."
            SecondListedOpportunity.click()
            sleep(4000) //Whitouth it, the 'pencil' is 'hovered' but not clicked, I assume is an effect of the angular animation
            
        and: "In the new page, click the 'pencil' button to edit the oportunity"
            //Perhaps due to the animation, but most of times it fails with a single click. So two clicks 
            //seems to work reliably. waitFor{} does not work as it only bring up front the tool tip
            $("a",'data-automation-id':"button-opportunity-edit" ).click()
            $("a",'data-automation-id':"button-opportunity-edit" ).click()
            sleep(2000)

        then: "We arrive at the CWU edit opportunity page and click the 'Delete this Opportunity'"
            waitFor{$("a",'data-automation-id':"button-cwu-delete" )}
            $("a",'data-automation-id':"button-cwu-delete" ).click()
            sleep(1000)

        and: "click Yes in the modal box"
            $("button",'data-automation-id':"button-modal-yes" ).click()
            sleep(2000) //Modal box to dissappear after the Yes

        then:"The opportunities page is loaded again"  
            assert waitFor {at OpportunitiesPage}  

        expect: "Confirm the CWU proposal does not exist anymore"
            assert SecondListedOpportunity.empty

    }


    def "Admin Deletes an SWU opportunity" () {
    
        given: "Starting from the Opportunities Page"
            waitFor {to OpportunitiesPage}

        when: "Click on the first entry of the list: it is a SWU opportunity."
            FirstListedOpportunity.click()
            sleep(4000) //Whitout it, the 'pencil' is 'hovered' but not clicked, I assume is an effect of the angular animation
            
        and: "In the new page, click the 'pencil' button to edit the oportunity"
            //Perhaps due to the animation, but most of times it fails with a single click. So two clicks 
            //seems to work reliably. waitFor{} does not work as it only bring up front the tool tip
            $("a",'data-automation-id':"btnEditOpportunity" ).click()
            $("a",'data-automation-id':"btnEditOpportunity" ).click()
            sleep(2000)

        then: "We arrive at the SWU edit opportunity page and click the 'Delete this Opportunity'"
            waitFor{$("a",'data-automation-id':"lnkDeleteOpp" )}
            $("a",'data-automation-id':"lnkDeleteOpp" ).click()

            sleep(1000)

        and: "click Yes in the modal box"
            $("button",'data-automation-id':"button-modal-yes" ).click()
            sleep(2000) //Modal box to dissappear after the Yes

        then:"The opportunities page is loaded again"  
            assert waitFor {at OpportunitiesPage}  

        expect: "Confirm the SWU proposal does not exist anymore"
            assert FirstListedOpportunity.empty

    }

  }

