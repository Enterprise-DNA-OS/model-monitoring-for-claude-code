DO $$ DECLARE mid uuid; bid uuid; pid uuid; BEGIN
 IF EXISTS(SELECT 1 FROM models WHERE source='fictional-demo') THEN RETURN; END IF;
 INSERT INTO models(source,external_id,name,version,owner,purpose,feature_name,unit,cuts,drift_limit,mae_limit,min_samples,review_due,retention_review_due,source_ref)
 VALUES('fictional-demo','demand-v1','Harbour Demand','v1','Morgan','Forecast cartons per order','order_size','cartons','[50,100]',0.25,10,10,current_date-3,current_date+90,'Fictional demo') RETURNING id INTO mid;
 INSERT INTO datasets(model_id,external_id,kind,window_start,window_end,expected_count,source_ref,digest)
 VALUES(mid,'reference','baseline',current_date-60,current_date-30,20,'Fictional baseline','seed-baseline') RETURNING id INTO bid;
 INSERT INTO datasets(model_id,external_id,kind,window_start,window_end,expected_count,source_ref,digest)
 VALUES(mid,'this-week','production',current_date-7,current_date,20,'Fictional production','seed-production') RETURNING id INTO pid;
 INSERT INTO observations(dataset_id,event_id,occurred_at,feature,prediction,actual,segment)
 SELECT bid,'B'||g,current_date-50+g*interval '1 hour',CASE WHEN g<=10 THEN 25 ELSE 75 END,100,98,CASE WHEN g<=10 THEN 'North' ELSE 'South' END FROM generate_series(1,20)g;
 INSERT INTO observations(dataset_id,event_id,occurred_at,feature,prediction,actual,segment)
 SELECT pid,'P'||g,current_date-2+g*interval '1 hour',CASE WHEN g<=2 THEN NULL WHEN g<=6 THEN 25 ELSE 125 END,120,CASE WHEN g<=4 THEN NULL ELSE 100 END,CASE WHEN g<=10 THEN 'North' ELSE 'South' END FROM generate_series(1,20)g;
 INSERT INTO actions(model_id,title,owner,due) VALUES(mid,'Check changed order-size feed','Morgan',current_date-2);
 INSERT INTO notes(model_id,body,actor) VALUES(mid,'Fictional data: distribution shift and delayed outcomes for weekly review','Demo seed');
 INSERT INTO models(source,external_id,name,version,owner,purpose,feature_name,unit,cuts,drift_limit,mae_limit,min_samples,review_due,retention_review_due,source_ref)
 VALUES('fictional-demo','demand-v2','Harbour Demand','v2','Taylor','Forecast cartons per order','order_size','cartons','[50,100]',0.25,10,10,current_date+7,current_date-1,'Fictional demo');
 INSERT INTO activity(model_id,actor,operation,detail) VALUES(mid,'Demo seed','seed','{"fictional":true}');
END $$;
